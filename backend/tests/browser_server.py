"""Opt-in browser integration fixture; never used by the production launcher.

Run from backend: ../.venv/Scripts/python tests/browser_server.py
All provider responses are deterministic fixtures, not live AI output.
"""

import os
import sys
from pathlib import Path

os.environ["APP_ENV"] = "browser-integration-fixture"
os.environ["BACKEND_TOKEN"] = "integration-test-only-local-token"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import json  # noqa: E402

import uvicorn  # noqa: E402

from app.api.dependencies import get_openrouter  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.contracts import FollowUpSet, GeneratedPrompt, IntentAnalysis, UsageMetadata  # noqa: E402


class FixtureReasoning:
    async def structured(self, schema, *, user, **_kwargs):
        method = {
            "name": "Small working prototype",
            "description": "Implement and validate the core workflow",
            "rationale": "Check the outcome before expanding scope",
        }
        if schema is IntentAnalysis:
            result = schema(
                goal="Build an event registration app",
                intended_output="Working application",
                domain="software",
                known_requirements=["Free registrations", "Local storage"],
                methodology=method,
            )
        elif schema is FollowUpSet:
            result = schema(
                questions=[
                    {
                        "id": "offline",
                        "question": "Should registrations work offline?",
                        "relevance": "Determines data persistence",
                        "choices": ["Yes", "No"],
                    }
                ]
            )
        else:
            payload = json.loads(user)
            decisions = "; ".join(
                f"{a['question']} {a['answer']}" for a in payload["confirmed_followup_answers"]
            )
            result = GeneratedPrompt(
                prompt=(
                    f"Objective: {payload['original_request']}\nConfirmed decisions: {decisions}\n"
                    "Deliver a working prototype and test registration, validation, and persistence."
                ),
                assumptions=["Browser integration fixture; live provider output is not being tested."],
            )
        return result, UsageMetadata(), "browser-test-fixture"


if __name__ == "__main__":
    app = create_app()
    app.dependency_overrides[get_openrouter] = FixtureReasoning
    uvicorn.run(app, host="127.0.0.1", port=8000)
