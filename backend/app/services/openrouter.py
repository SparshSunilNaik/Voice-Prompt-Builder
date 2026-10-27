import copy
import json
import logging
import re
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.core.errors import ConfigurationError, ProviderError
from app.models.contracts import UsageMetadata

T = TypeVar("T", bound=BaseModel)
logger = logging.getLogger(__name__)
CHAT_COMPLETIONS_PATH = "/chat/completions"
UNSUPPORTED_STRICT_KEYWORDS = {
    "default",
    "examples",
    "maxItems",
    "maxLength",
    "maximum",
    "minItems",
    "minLength",
    "minimum",
    "pattern",
    "title",
}


class StructuredCompletion(BaseModel):
    data: BaseModel
    usage: UsageMetadata
    model: str


def parse_json_content(content: str) -> object:
    cleaned = re.sub(r"^\s*```(?:json)?|```\s*$", "", content.strip(), flags=re.IGNORECASE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def strict_provider_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Convert Pydantic JSON Schema to OpenAI/OpenRouter's strict supported subset.

    Pydantic defaults are enforced after completion. The provider schema requires every
    object property and forbids undeclared properties so strict mode accepts nested models.
    """

    schema = copy.deepcopy(model.model_json_schema())

    def normalize(node: Any) -> None:
        if isinstance(node, dict):
            for keyword in UNSUPPORTED_STRICT_KEYWORDS:
                node.pop(keyword, None)
            properties = node.get("properties")
            if node.get("type") == "object" and isinstance(properties, dict):
                node["additionalProperties"] = False
                node["required"] = list(properties)
            for value in node.values():
                normalize(value)
        elif isinstance(node, list):
            for value in node:
                normalize(value)

    normalize(schema)
    return schema


def _request_id(response: httpx.Response) -> str:
    return response.headers.get("x-request-id") or response.headers.get("cf-ray") or "unavailable"


def _upstream_category(response: httpx.Response) -> str:
    status = response.status_code
    if status in {401, 403}:
        return "credentials_or_permissions"
    if status == 402:
        return "insufficient_credits"
    if status == 404:
        return "model_or_endpoint_unavailable"
    if status == 429:
        return "rate_limit"
    if status in {400, 422}:
        try:
            error_text = json.dumps(response.json().get("error", {})).lower()
        except (ValueError, AttributeError):
            error_text = ""
        schema_terms = ("schema", "response_format", "additionalproperties", "structured")
        return (
            "structured_output_request"
            if any(term in error_text for term in schema_terms)
            else "request_rejected"
        )
    if status >= 500:
        return "provider_unavailable"
    return "http_error"


class OpenRouterClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self.settings = settings
        self._client = client

    async def structured(
        self, schema: type[T], *, schema_name: str, system: str, user: str, retries: int = 1
    ) -> tuple[T, UsageMetadata, str]:
        if not self.settings.openrouter_configured:
            raise ConfigurationError("OpenRouter")
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self.settings.openrouter_timeout_seconds)
        provider_schema = strict_provider_schema(schema)
        strict_mode = True
        try:
            for attempt in range(retries + 1):
                response_format: dict[str, Any]
                messages = [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ]
                if strict_mode:
                    response_format = {
                        "type": "json_schema",
                        "json_schema": {
                            "name": schema_name,
                            "strict": True,
                            "schema": provider_schema,
                        },
                    }
                else:
                    response_format = {"type": "json_object"}
                    messages[0]["content"] += (
                        "\nThe provider rejected strict schema mode. Return one JSON object that "
                        "matches this schema; it will be validated server-side:\n"
                        + json.dumps(provider_schema, separators=(",", ":"))
                    )
                try:
                    response = await client.post(
                        f"{self.settings.openrouter_base_url.rstrip('/')}{CHAT_COMPLETIONS_PATH}",
                        headers={
                            "Authorization": f"Bearer {self.settings.openrouter_api_key}",
                            "Content-Type": "application/json",
                            "X-OpenRouter-Title": "Voice Prompt Builder",
                        },
                        json={
                            "model": self.settings.openrouter_model,
                            "messages": messages,
                            "temperature": 0.2,
                            "response_format": response_format,
                        },
                    )
                except (httpx.TimeoutException, httpx.NetworkError) as exc:
                    logger.warning(
                        "openrouter_network_error category=%s model=%s endpoint=%s",
                        type(exc).__name__,
                        self.settings.openrouter_model,
                        CHAT_COMPLETIONS_PATH,
                    )
                    raise ProviderError(
                        "OpenRouter is temporarily unreachable. Check the network and try again.",
                        status_code=502,
                        code="provider_network",
                    ) from exc

                category = _upstream_category(response) if response.status_code >= 400 else "success"
                if response.status_code in {400, 422} and strict_mode and attempt < retries:
                    logger.warning(
                        "openrouter_strict_fallback status=%s category=%s request_id=%s model=%s endpoint=%s",
                        response.status_code,
                        category,
                        _request_id(response),
                        self.settings.openrouter_model,
                        CHAT_COMPLETIONS_PATH,
                    )
                    strict_mode = False
                    continue
                self._raise_for_status(response, category)

                try:
                    body = response.json()
                    content = body["choices"][0]["message"]["content"]
                except (ValueError, KeyError, IndexError, TypeError) as exc:
                    logger.warning(
                        "openrouter_response_invalid category=response_shape "
                        "request_id=%s model=%s endpoint=%s",
                        _request_id(response),
                        self.settings.openrouter_model,
                        CHAT_COMPLETIONS_PATH,
                    )
                    if attempt >= retries:
                        raise ProviderError(
                            "OpenRouter returned an incomplete response. Please retry.",
                            status_code=502,
                            code="provider_response_shape",
                        ) from exc
                    continue

                try:
                    parsed = parse_json_content(content)
                except (TypeError, ValueError) as exc:
                    logger.warning(
                        "openrouter_validation_failed category=json_decode request_id=%s model=%s schema=%s",
                        _request_id(response),
                        self.settings.openrouter_model,
                        schema_name,
                    )
                    if attempt >= retries:
                        raise ProviderError(
                            "OpenRouter returned malformed JSON. Please retry.",
                            status_code=502,
                            code="provider_json_validation",
                        ) from exc
                    continue

                try:
                    result = schema.model_validate(parsed)
                    usage = UsageMetadata.model_validate(body.get("usage") or {})
                except ValidationError as exc:
                    logger.warning(
                        "openrouter_validation_failed category=pydantic_schema "
                        "errors=%s request_id=%s model=%s schema=%s",
                        exc.error_count(),
                        _request_id(response),
                        self.settings.openrouter_model,
                        schema_name,
                    )
                    if attempt >= retries:
                        raise ProviderError(
                            "OpenRouter returned JSON that did not match the required response schema.",
                            status_code=502,
                            code="provider_schema_validation",
                        ) from exc
                    continue
                return result, usage, body.get("model", self.settings.openrouter_model)
        finally:
            if owns_client:
                await client.aclose()
        raise ProviderError("OpenRouter request failed", status_code=502, code="provider_error")

    def _raise_for_status(self, response: httpx.Response, category: str) -> None:
        if response.status_code < 400:
            return
        logger.warning(
            "openrouter_http_error status=%s category=%s request_id=%s model=%s endpoint=%s",
            response.status_code,
            category,
            _request_id(response),
            self.settings.openrouter_model,
            CHAT_COMPLETIONS_PATH,
        )
        status = response.status_code
        if status in {401, 403}:
            raise ProviderError(
                "OpenRouter rejected the credentials or model permissions. "
                "Check the API key and account access.",
                status_code=502,
                code="provider_auth",
            )
        if status == 402:
            raise ProviderError(
                "OpenRouter requires additional credits or payment before this request can run.",
                status_code=402,
                code="provider_credits",
            )
        if status == 404:
            raise ProviderError(
                f"OpenRouter could not access model '{self.settings.openrouter_model}' "
                "or the endpoint is unavailable.",
                status_code=502,
                code="provider_not_found",
            )
        if status == 429:
            raise ProviderError(
                "OpenRouter rate limit reached. Wait briefly, then retry.",
                status_code=429,
                code="provider_rate_limit",
            )
        if status in {400, 422}:
            raise ProviderError(
                "OpenRouter rejected the structured request. The model may not support a required parameter.",
                status_code=502,
                code="provider_request_rejected",
            )
        if status >= 500:
            raise ProviderError(
                "OpenRouter or its model provider is temporarily unavailable.",
                status_code=502,
                code="provider_unavailable",
            )
        raise ProviderError("OpenRouter request failed.", status_code=502, code="provider_error")
