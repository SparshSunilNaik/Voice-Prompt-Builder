import json

from fastapi.testclient import TestClient

from app.api.dependencies import get_openrouter
from app.config import get_settings
from app.main import create_app
from app.models.contracts import GeneratedPrompt, IntentAnalysis, UsageMetadata
from app.services.prompt_engine import GENERATE_SYSTEM_PROMPT, INTENT_SYSTEM_PROMPT

ANALYSIS = {
    "goal": "Write a product launch email",
    "intended_output": "Email prompt",
    "domain": "marketing",
    "methodology": {"name": "Direct", "description": "Direct writing", "rationale": "Simple task"},
}
LESSONS = [
    "Keep prompts concise; the user found earlier prompts too long. (flagged 2 times)",
    'Earlier feedback from the user: "less corporate, more friendly"',
]


class Recorder:
    def __init__(self):
        self.calls: list[dict] = []

    async def structured(self, schema, **kwargs):
        self.calls.append(kwargs)
        if schema is IntentAnalysis:
            return schema.model_validate(ANALYSIS), UsageMetadata(), "mock/model"
        return GeneratedPrompt(prompt="Write a short, friendly launch email."), UsageMetadata(), "mock/model"


def client(provider) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_openrouter] = lambda: provider
    return TestClient(app, headers={"Authorization": f"Bearer {get_settings().backend_token}"})


def test_regeneration_sends_rejection_and_learned_penalties_to_the_generator() -> None:
    provider = Recorder()
    response = client(provider).post(
        "/api/generate",
        json={
            "input": "Write a launch email for our app",
            "analysis": ANALYSIS,
            "methodology": ANALYSIS["methodology"],
            "previous_prompt": "A very long corporate prompt",
            "revision_request": "The user rejected the previous prompt. Problems they flagged: Too long.",
            "learned_feedback": LESSONS,
        },
    )
    assert response.status_code == 200, response.text
    payload = json.loads(provider.calls[0]["user"])
    assert payload["learned_user_feedback"] == LESSONS
    assert payload["previous_prompt"] == "A very long corporate prompt"
    assert payload["revision_request"].startswith("The user rejected the previous prompt.")
    assert "Treat them as penalties" in provider.calls[0]["system"]


def test_analysis_uses_learned_feedback_only_when_present() -> None:
    provider = Recorder()
    api = client(provider)
    assert (
        api.post(
            "/api/analyze", json={"input": "Write a launch email", "learned_feedback": LESSONS}
        ).status_code
        == 200
    )
    assert "learned_user_feedback (from earlier prompts)" in provider.calls[0]["user"]
    assert "too long" in provider.calls[0]["user"]
    assert api.post("/api/analyze", json={"input": "Write a launch email"}).status_code == 200
    assert "learned_user_feedback" not in provider.calls[1]["user"]
    assert "learned_user_feedback" in INTENT_SYSTEM_PROMPT and "penalt" in GENERATE_SYSTEM_PROMPT


def test_learned_feedback_is_bounded() -> None:
    api = client(Recorder())
    too_many = api.post(
        "/api/analyze", json={"input": "Write a launch email", "learned_feedback": ["x"] * 11}
    )
    too_long = api.post(
        "/api/analyze", json={"input": "Write a launch email", "learned_feedback": ["x" * 301]}
    )
    assert too_many.status_code == 422 and too_long.status_code == 422
