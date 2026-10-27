import json
import re
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.core.errors import ConfigurationError, ProviderError
from app.models.contracts import UsageMetadata

T = TypeVar("T", bound=BaseModel)


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
        try:
            for attempt in range(retries + 1):
                try:
                    response = await client.post(
                        f"{self.settings.openrouter_base_url.rstrip('/')}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.settings.openrouter_api_key}",
                            "Content-Type": "application/json",
                            "X-OpenRouter-Title": "Voice Prompt Builder",
                        },
                        json={
                            "model": self.settings.openrouter_model,
                            "messages": [
                                {"role": "system", "content": system},
                                {"role": "user", "content": user},
                            ],
                            "temperature": 0.2,
                            "response_format": {
                                "type": "json_schema",
                                "json_schema": {
                                    "name": schema_name,
                                    "strict": True,
                                    "schema": schema.model_json_schema(),
                                },
                            },
                        },
                    )
                except (httpx.TimeoutException, httpx.NetworkError) as exc:
                    raise ProviderError(
                        "OpenRouter is temporarily unreachable",
                        status_code=502,
                        code="provider_network",
                    ) from exc
                self._raise_for_status(response)
                body = response.json()
                try:
                    content = body["choices"][0]["message"]["content"]
                    result = schema.model_validate(parse_json_content(content))
                    usage = UsageMetadata.model_validate(body.get("usage") or {})
                    return result, usage, body.get("model", self.settings.openrouter_model)
                except (KeyError, IndexError, TypeError, ValueError, ValidationError) as exc:
                    if attempt >= retries:
                        raise ProviderError(
                            "OpenRouter returned invalid structured output",
                            status_code=502,
                            code="provider_response",
                        ) from exc
        finally:
            if owns_client:
                await client.aclose()
        raise ProviderError("OpenRouter request failed", status_code=502, code="provider_error")

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.status_code in {401, 403}:
            raise ProviderError("OpenRouter credentials were rejected", status_code=502, code="provider_auth")
        if response.status_code == 429:
            raise ProviderError("OpenRouter rate limit reached", status_code=429, code="provider_rate_limit")
        if response.status_code >= 400:
            raise ProviderError("OpenRouter request failed", status_code=502, code="provider_error")
