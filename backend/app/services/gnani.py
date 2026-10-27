import httpx
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.core.errors import ConfigurationError, ProviderError
from app.services.audio import NormalizedAudio


class GnaniResponse(BaseModel):
    success: bool
    request_id: str | None = None
    transcript: str


class GnaniClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self.settings = settings
        self._client = client

    async def transcribe(self, audio: NormalizedAudio) -> GnaniResponse:
        if not self.settings.gnani_configured:
            raise ConfigurationError("Gnani")
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=45)
        try:
            response = await client.post(
                self.settings.gnani_stt_url,
                headers={"X-API-Key-ID": self.settings.gnani_api_key},
                files={"audio_file": (audio.filename, audio.content, audio.content_type)},
                data={
                    "language_code": self.settings.gnani_language_code,
                    "format": self.settings.gnani_stt_format,
                },
            )
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            raise ProviderError(
                "Gnani is temporarily unreachable", status_code=502, code="provider_network"
            ) from exc
        finally:
            if owns_client:
                await client.aclose()
        if response.status_code in {401, 403}:
            raise ProviderError("Gnani credentials were rejected", status_code=502, code="provider_auth")
        if response.status_code == 429:
            raise ProviderError("Gnani rate limit reached", status_code=429, code="provider_rate_limit")
        if response.status_code >= 400:
            raise ProviderError(
                "Gnani could not transcribe this recording", status_code=502, code="provider_error"
            )
        try:
            result = GnaniResponse.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise ProviderError(
                "Gnani returned an invalid response", status_code=502, code="provider_response"
            ) from exc
        if not result.success or not result.transcript.strip():
            raise ProviderError("No speech was recognized", status_code=422, code="empty_transcript")
        return result
