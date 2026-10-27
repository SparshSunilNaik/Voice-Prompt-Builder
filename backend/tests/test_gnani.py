import io
import wave

import httpx
import pytest

from app.config import Settings
from app.core.errors import AppError, ConfigurationError, ProviderError
from app.services.audio import NormalizedAudio, normalize_audio, validate_audio
from app.services.gnani import GnaniClient


def settings(**values: str) -> Settings:
    return Settings(_env_file=None, gnani_api_key="test-key", **values)


def test_audio_validation_rejects_size_and_format() -> None:
    with pytest.raises(AppError, match="size"):
        validate_audio(b"x" * 11, "voice.wav", "audio/wav", max_size_mb=0.00001)
    with pytest.raises(AppError, match="Unsupported"):
        validate_audio(b"data", "voice.exe", "application/octet-stream", 1)


def wav_bytes(seconds: int) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(10)
        audio.writeframes(b"\0\0" * 10 * seconds)
    return output.getvalue()


@pytest.mark.asyncio
async def test_wav_duration_and_structure_are_validated() -> None:
    with pytest.raises(AppError, match="duration"):
        await normalize_audio(wav_bytes(2), "voice.wav", "audio/wav", 1, max_duration_seconds=1)
    with pytest.raises(AppError, match="Invalid WAV"):
        await normalize_audio(b"RIFFnot-valid", "voice.wav", "audio/wav", 1)


@pytest.mark.asyncio
async def test_gnani_multipart_and_response_parsing() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-API-Key-ID"] == "test-key"
        assert b'name="audio_file"' in await request.aread()
        return httpx.Response(200, json={"success": True, "request_id": "r1", "transcript": "Build it"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    result = await GnaniClient(settings(), client).transcribe(NormalizedAudio(b"RIFF", "x.wav", "audio/wav"))
    await client.aclose()
    assert result.transcript == "Build it"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,code", [(403, "provider_auth"), (429, "provider_rate_limit"), (500, "provider_error")]
)
async def test_gnani_maps_provider_errors(status: int, code: str) -> None:
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(status)))
    with pytest.raises(ProviderError) as error:
        await GnaniClient(settings(), client).transcribe(NormalizedAudio(b"x", "x.wav", "audio/wav"))
    await client.aclose()
    assert error.value.code == code


@pytest.mark.asyncio
async def test_gnani_requires_credentials() -> None:
    with pytest.raises(ConfigurationError):
        await GnaniClient(Settings(_env_file=None)).transcribe(NormalizedAudio(b"x", "x.wav", "audio/wav"))
