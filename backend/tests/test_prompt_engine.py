import json

from app.models.contracts import GenerateRequest, IntentAnalysis, Methodology, RefineRequest
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
            {"question_id": "audience", "answer": "Agents", "skipped": False},
            {"question_id": "budget", "answer": "", "skipped": True},
        ],
    )
    payload = json.loads(generation_user_prompt(request))
    assert payload["confirmed_followup_answers"][0]["answer"] == "Agents"
    assert payload["skipped_question_ids"] == ["budget"]
