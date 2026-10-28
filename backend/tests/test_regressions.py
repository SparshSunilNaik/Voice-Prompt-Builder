import io
import shutil
import subprocess
import wave

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_openrouter
from app.config import Settings, get_settings
from app.core.errors import AppError, ProviderError
from app.main import create_app
from app.models.contracts import GenerateRequest, IntentAnalysis
from app.services.audio import normalize_audio
from app.services.openrouter import OpenRouterClient
from app.services.prompt_engine import generation_user_prompt


def test_local_request_budget_returns_an_actionable_limit(monkeypatch):
    settings = get_settings().model_copy(update={"max_requests_per_minute": 3})
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    client = TestClient(create_app(), headers={"Authorization": f"Bearer {settings.backend_token}"})
    for _ in range(3):
        assert client.post("/api/analyze", json={"input": "x"}).status_code == 422
    limited = client.post("/api/analyze", json={"input": "x"})
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "local_rate_limit"


def test_pairing_blocks_unrelated_extension_and_originless_requests():
    client = TestClient(create_app())
    for headers in [{}, {"Origin": "chrome-extension://" + "b" * 32, "X-Extension-Request": "1"}]:
        response = client.post("/api/analyze", json={"input": "Build a tool"}, headers=headers)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "pairing_required"
    assert get_settings().backend_token not in client.get("/health").text


def test_raw_body_limit_rejects_before_provider_call():
    app = create_app()
    calls = []
    app.dependency_overrides[get_openrouter] = lambda: calls.append(True)
    client = TestClient(app, headers={"Authorization": f"Bearer {get_settings().backend_token}"})
    result = client.post("/api/analyze", content=b"x" * 131073)
    assert result.status_code == 413
    assert calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize("content", [None, [], "", {"text": "not a string"}])
async def test_provider_refusal_or_wrong_content_is_an_actionable_error(content):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(
                200, json={"choices": [{"message": {"content": content, "refusal": "Refused"}}]}
            )
        )
    ) as client:
        provider = OpenRouterClient(Settings(_env_file=None, openrouter_api_key="synthetic"), client)
        with pytest.raises(ProviderError) as error:
            await provider.structured(IntentAnalysis, schema_name="test", system="test", user="test")
        assert error.value.code == "provider_response_shape"


def test_question_text_is_preserved_in_synthesis_and_missing_text_rejected():
    from pydantic import ValidationError

    analysis = {
        "goal": "Build",
        "domain": "software",
        "intended_output": "App",
        "methodology": {"name": "Simple", "description": "Build it", "rationale": "Fits"},
    }
    request = GenerateRequest(
        input="Build a tool",
        analysis=analysis,
        methodology=analysis["methodology"],
        answers=[{"question_id": "q1", "question": "Should it work offline?", "answer": "Yes"}],
    )
    assert "Should it work offline?" in generation_user_prompt(request)
    with pytest.raises(ValidationError):
        GenerateRequest(
            input="Build a tool",
            analysis=analysis,
            methodology=analysis["methodology"],
            answers=[{"question_id": "q1", "answer": "Yes"}],
        )
    with pytest.raises(ValidationError):
        IntentAnalysis(**{**analysis, "goal": "x" * 1000000})


@pytest.mark.asyncio
async def test_real_ffmpeg_webm_conversion_invalid_media_and_duration(tmp_path):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        pytest.skip("FFmpeg not installed")
    source = tmp_path / "voice.webm"
    subprocess.run(
        [
            ffmpeg,
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=16000",
            "-t",
            "0.25",
            "-c:a",
            "libopus",
            str(source),
        ],
        check=True,
        timeout=15,
    )
    audio = await normalize_audio(source.read_bytes(), source.name, "audio/webm", 1, 60)
    with wave.open(io.BytesIO(audio.content)) as recording:
        assert recording.getnchannels() == 1
        assert recording.getframerate() == 16000
    with pytest.raises(AppError, match="decode"):
        await normalize_audio(b"not audio", "fake.mp3", "audio/mpeg", 1, 60)
    long_audio = tmp_path / "long.mp3"
    subprocess.run(
        [
            ffmpeg,
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=16000",
            "-t",
            "2",
            str(long_audio),
        ],
        check=True,
        timeout=15,
    )
    with pytest.raises(AppError, match="duration"):
        await normalize_audio(long_audio.read_bytes(), long_audio.name, "audio/mpeg", 1, 1)
    drift = tmp_path / "timer-drift.webm"
    subprocess.run(
        [
            ffmpeg,
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=16000",
            "-t",
            "1.25",
            "-c:a",
            "libopus",
            str(drift),
        ],
        check=True,
        timeout=15,
    )
    trimmed = await normalize_audio(drift.read_bytes(), drift.name, "audio/webm", 1, 1)
    with wave.open(io.BytesIO(trimmed.content)) as recording:
        assert recording.getnframes() / recording.getframerate() == 1
