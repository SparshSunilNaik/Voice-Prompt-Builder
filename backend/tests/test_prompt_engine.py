import json

import pytest
from pydantic import ValidationError

from app.models.contracts import (
    FollowUpQuestion,
    FollowUpSet,
    GenerateRequest,
    IntentAnalysis,
    Methodology,
    RefineRequest,
)
from app.services.prompt_engine import analysis_user_prompt, followup_user_prompt, generation_user_prompt


def analysis() -> IntentAnalysis:
    return IntentAnalysis(
        goal="Automate support",
        intended_output="Implementation plan",
        domain="customer support",
        known_requirements=["Use existing articles"],
        missing_requirements=["Escalation policy"],
        methodology=Methodology(
            name="RAG with workflows", description="Ground answers", rationale="Known corpus"
        ),
    )


def test_analysis_prompt_preserves_user_request() -> None:
    assert analysis_user_prompt("  Build support AI  ").endswith("Build support AI")


def test_followup_context_includes_selected_methodology() -> None:
    selected = Methodology(name="Workflow", description="Rules", rationale="Predictable")
    payload = json.loads(
        followup_user_prompt(
            RefineRequest(input="Build support AI", analysis=analysis(), methodology=selected)
        )
    )
    assert payload["selected_methodology"]["name"] == "Workflow"
    assert payload["analysis"]["missing_requirements"] == ["Escalation policy"]


def test_generation_distinguishes_skipped_and_confirmed_answers() -> None:
    request = GenerateRequest(
        input="Build support AI",
        analysis=analysis(),
        methodology=analysis().methodology,
        answers=[
            {"question": "Which scope?", "question_id": "audience", "answer": "Agents", "skipped": False},
            {"question": "Which scope?", "question_id": "budget", "answer": "", "skipped": True},
        ],
    )
    payload = json.loads(generation_user_prompt(request))
    assert payload["confirmed_followup_answers"][0]["answer"] == "Agents"
    assert payload["skipped_question_ids"] == ["budget"]
    assert payload["skipped_questions"][0]["question"] == "Which scope?"


def test_revision_context_preserves_previous_prompt_and_requested_change() -> None:
    request = GenerateRequest(
        input="Build support AI",
        analysis=analysis(),
        methodology=analysis().methodology,
        previous_prompt="First draft",
        revision_request="Prefer a deterministic escalation flow",
    )
    payload = json.loads(generation_user_prompt(request))
    assert payload["previous_prompt"] == "First draft"
    assert payload["revision_request"].startswith("Prefer")


def test_followups_have_unique_ids_and_hard_limit() -> None:
    def question(identifier: str) -> FollowUpQuestion:
        return FollowUpQuestion(
            id=identifier, question="Who uses this?", relevance="Changes audience", skippable=True
        )

    with pytest.raises(ValidationError, match="unique"):
        FollowUpSet(questions=[question("audience"), question("audience")])
    with pytest.raises(ValidationError, match="at most 3"):
        FollowUpSet(questions=[question(str(index)) for index in range(4)])


def test_duplicate_answers_are_rejected() -> None:
    with pytest.raises(ValidationError, match="unique"):
        GenerateRequest(
            input="Build support AI",
            analysis=analysis(),
            methodology=analysis().methodology,
            answers=[
                {"question": "Which scope?", "question_id": "scope", "answer": "A"},
                {"question": "Which scope?", "question_id": "scope", "answer": "B"},
            ],
        )
