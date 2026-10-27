from fastapi.testclient import TestClient

from app.api.dependencies import get_gnani, get_openrouter
from app.main import create_app
from app.models.contracts import FollowUpSet, GeneratedPrompt, IntentAnalysis, UsageMetadata
from app.services.gnani import GnaniResponse


class FakeGnani:
    async def transcribe(self, _audio):
        return GnaniResponse(success=True, request_id="request-1", transcript="typed by voice")


class FakeOpenRouter:
    async def structured(self, schema, **_kwargs):
        if schema is IntentAnalysis:
            result = schema.model_validate(
                {
                    "goal": "Build a support assistant",
                    "intended_output": "Architecture plan",
                    "domain": "software",
                    "methodology": {
                        "name": "Hybrid",
                        "description": "RAG plus workflows",
                        "rationale": "Balances control and coverage",
                    },
                }
            )
        elif schema is FollowUpSet:
            result = schema(questions=[])
        else:
            result = GeneratedPrompt(prompt="Create a tested support assistant plan.")
        return result, UsageMetadata(total_tokens=10), "mock/model"


def client() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_gnani] = lambda: FakeGnani()
    app.dependency_overrides[get_openrouter] = lambda: FakeOpenRouter()
    return TestClient(app)


def test_all_api_endpoints_with_provider_mocks() -> None:
    api = client()
    audio = api.post("/api/transcribe", files={"audio": ("voice.wav", b"RIFFdata", "audio/wav")})
    assert audio.json()["transcript"] == "typed by voice"
    analysis = api.post("/api/analyze", json={"input": "Build a support assistant"})
    assert analysis.status_code == 200
    refine = api.post(
        "/api/refine",
        json={
            "input": "Build a support assistant",
            "analysis": analysis.json()["analysis"],
            "methodology": analysis.json()["analysis"]["methodology"],
        },
    )
    assert refine.json()["questions"] == []
    generated = api.post(
        "/api/generate",
        json={
            "input": "Build a support assistant",
            "analysis": analysis.json()["analysis"],
            "methodology": analysis.json()["analysis"]["methodology"],
        },
    )
    assert generated.json()["prompt"].startswith("Create")


def test_rejects_unauthorized_browser_origin_and_invalid_request() -> None:
    api = client()
    denied = api.post(
        "/api/analyze", json={"input": "valid request"}, headers={"Origin": "https://evil.example"}
    )
    assert denied.status_code == 403
    invalid = api.post("/api/analyze", json={"input": "x"})
    assert invalid.status_code == 422
