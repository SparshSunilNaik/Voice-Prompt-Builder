import json

import httpx
import pytest
from pydantic import BaseModel

from app.config import Settings
from app.core.errors import ConfigurationError, ProviderError
from app.services.openrouter import OpenRouterClient, parse_json_content


class Result(BaseModel):
    answer: str


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


@pytest.mark.asyncio
async def test_structured_completion_sends_schema_and_returns_usage() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(await request.aread())
        assert payload["response_format"]["type"] == "json_schema"
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
    assert error.value.code == "provider_response"
    assert calls == 2
