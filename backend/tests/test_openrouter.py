import json

import httpx
import pytest
from pydantic import BaseModel, Field

from app.config import Settings
from app.core.errors import ConfigurationError, ProviderError
from app.services.openrouter import OpenRouterClient, parse_json_content, strict_provider_schema


class Result(BaseModel):
    answer: str


class NestedResult(BaseModel):
    label: str = "default label"


class ComplexResult(BaseModel):
    items: list[NestedResult] = Field(default_factory=list, max_length=3)


def settings() -> Settings:
    return Settings(_env_file=None, openrouter_api_key="test-key")


def response(content: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "model": "test/model",
            "choices": [{"message": {"content": content}}],
            "usage": {"prompt_tokens": 2, "completion_tokens": 3, "total_tokens": 5},
        },
    )


def test_json_repair_extracts_fenced_or_surrounded_object() -> None:
    assert parse_json_content('```json\n{"answer":"yes"}\n```') == {"answer": "yes"}
    assert parse_json_content('Result: {"answer":"yes"} done') == {"answer": "yes"}


def test_strict_schema_normalizes_nested_pydantic_models() -> None:
    schema = strict_provider_schema(ComplexResult)
    assert schema["additionalProperties"] is False
    assert schema["required"] == ["items"]
    assert "maxItems" not in schema["properties"]["items"]
    nested = schema["$defs"]["NestedResult"]
    assert nested["additionalProperties"] is False
    assert nested["required"] == ["label"]
    assert "default" not in nested["properties"]["label"]


@pytest.mark.asyncio
async def test_structured_completion_sends_schema_and_returns_usage() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(await request.aread())
        assert payload["response_format"]["type"] == "json_schema"
        assert payload["response_format"]["json_schema"]["schema"]["additionalProperties"] is False
        assert request.headers["authorization"] == "Bearer test-key"
        return response('{"answer":"yes"}')

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    result, usage, model = await OpenRouterClient(settings(), http).structured(
        Result, schema_name="result", system="Be concise", user="Question"
    )
    await http.aclose()
    assert result.answer == "yes"
    assert usage.total_tokens == 5
    assert model == "test/model"


@pytest.mark.asyncio
async def test_structured_completion_bounded_retry() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return response("not-json" if calls == 1 else '{"answer":"repaired"}')

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    result, _, _ = await OpenRouterClient(settings(), http).structured(
        Result, schema_name="result", system="system", user="user"
    )
    await http.aclose()
    assert result.answer == "repaired"
    assert calls == 2


@pytest.mark.asyncio
async def test_openrouter_credentials_and_errors() -> None:
    with pytest.raises(ConfigurationError):
        await OpenRouterClient(Settings(_env_file=None)).structured(
            Result, schema_name="result", system="system", user="user"
        )
    http = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(401)))
    with pytest.raises(ProviderError) as error:
        await OpenRouterClient(settings(), http).structured(
            Result, schema_name="result", system="system", user="user"
        )
    await http.aclose()
    assert error.value.code == "provider_auth"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "code", "message"),
    [
        (400, "provider_request_rejected", "structured request"),
        (401, "provider_auth", "credentials or model permissions"),
        (402, "provider_credits", "credits or payment"),
        (404, "provider_not_found", "could not access model"),
        (429, "provider_rate_limit", "rate limit"),
    ],
)
async def test_openrouter_maps_live_http_failure_categories(status: int, code: str, message: str) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            status,
            headers={"x-request-id": "safe-request-id"},
            json={"error": {"code": status, "message": "request rejected"}},
        )

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    with pytest.raises(ProviderError) as error:
        await OpenRouterClient(settings(), http).structured(
            Result, schema_name="result", system="system", user="private user prompt"
        )
    await http.aclose()
    assert error.value.code == code
    assert message in error.value.message.lower()
    assert calls == (2 if status == 400 else 1)


@pytest.mark.asyncio
async def test_strict_request_rejection_uses_one_validated_json_fallback() -> None:
    formats: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(await request.aread())
        formats.append(payload["response_format"]["type"])
        if len(formats) == 1:
            return httpx.Response(
                400,
                json={"error": {"code": 400, "message": "invalid response_format schema"}},
            )
        return response('{"answer":"fallback validated"}')

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    result, _, _ = await OpenRouterClient(settings(), http).structured(
        Result, schema_name="result", system="system", user="user"
    )
    await http.aclose()
    assert result.answer == "fallback validated"
    assert formats == ["json_schema", "json_object"]


@pytest.mark.asyncio
async def test_diagnostic_logs_exclude_credentials_and_prompts(caplog: pytest.LogCaptureFixture) -> None:
    http = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(401, headers={"x-request-id": "request-123"}))
    )
    with caplog.at_level("WARNING"), pytest.raises(ProviderError):
        await OpenRouterClient(settings(), http).structured(
            Result,
            schema_name="result",
            system="secret system instructions",
            user="private customer prompt",
        )
    await http.aclose()
    assert "request-123" in caplog.text
    assert "test-key" not in caplog.text
    assert "private customer prompt" not in caplog.text
    assert "secret system instructions" not in caplog.text


@pytest.mark.asyncio
async def test_malformed_output_fails_after_bounded_retry() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return response('{"wrong":"shape"}')

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    with pytest.raises(ProviderError) as error:
        await OpenRouterClient(settings(), http).structured(
            Result, schema_name="result", system="system", user="user"
        )
    await http.aclose()
    assert error.value.code == "provider_schema_validation"
    assert calls == 2
