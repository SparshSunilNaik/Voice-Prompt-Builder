import json

from fastapi.testclient import TestClient

from app.api.dependencies import get_openrouter
from app.config import get_settings
from app.main import create_app
from app.models.contracts import GenerateRequest, NextQuestionDecision, PromptingStrategy, UsageMetadata
from app.services.openrouter import strict_provider_schema
from app.services.prompt_engine import (
    GENERATE_SYSTEM_PROMPT,
    ILLUSTRATIVE_HEADING,
    INTENT_SYSTEM_PROMPT,
    NEXT_QUESTION_SYSTEM_PROMPT,
    generation_user_prompt,
    technique_requirements,
)

ANALYSIS = {
    "goal": "Classify customer emails",
    "intended_output": "A labelling prompt",
    "domain": "support",
    "methodology": {
        "name": "Example-guided classification",
        "description": "Few-shot labelling",
        "rationale": "Labels follow a pattern",
        "prompting": {"example_count": 3, "example_source": "illustrative"},
    },
}


class ScriptedOpenRouter:
    """Returns queued decisions and records what the backend sent."""

    def __init__(self, *decisions: dict):
        self.decisions = list(decisions)
        self.calls: list[dict] = []

    async def structured(self, schema, **kwargs):
        self.calls.append(kwargs)
        return schema.model_validate(self.decisions.pop(0)), UsageMetadata(total_tokens=7), "mock/model"


def api(provider) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_openrouter] = lambda: provider
    return TestClient(app, headers={"Authorization": f"Bearer {get_settings().backend_token}"})


def body(answers=()):
    return {
        "input": "Help me sort support emails into billing, bugs and feature requests",
        "analysis": ANALYSIS,
        "methodology": ANALYSIS["methodology"],
        "answers": list(answers),
    }


def test_strategy_keeps_technique_fields_consistent() -> None:
    few = PromptingStrategy(example_count=3, reasoning="chain_of_thought", techniques=["self_critique"] * 2)
    assert few.examples == "few_shot" and few.example_source == "illustrative"
    assert few.techniques == ["self_critique"]
    zero = PromptingStrategy(example_count=0, example_source="user_supplied")
    assert zero.examples == "zero_shot" and zero.example_source == "none"
    assert PromptingStrategy(example_count=1, example_source="user_supplied").examples == "one_shot"


def test_decision_schema_is_strict_provider_compatible() -> None:
    schema = strict_provider_schema(NextQuestionDecision)
    assert schema["additionalProperties"] is False
    assert schema["required"] == ["strategy_review", "strategy", "done", "reason", "question"]
    strategy = schema["$defs"]["PromptingStrategy"]
    assert "techniques" in strategy["required"] and "example_source" in strategy["required"]


def test_next_question_adapts_to_answers_and_updates_strategy() -> None:
    provider = ScriptedOpenRouter(
        {
            "done": False,
            "reason": "User said they have examples; ask how many.",
            "question": {
                "id": "Example count?!",
                "question": "How many of your own labelled emails can you share?",
                "relevance": "Sets the number of demonstrations.",
                "choices": ["One", "Two or three", "Two or three", "  ", "Five", "Ten"],
            },
            "strategy": {
                "example_count": 2,
                "example_source": "user_supplied",
                "reasoning": "chain_of_thought",
                "techniques": ["structured_output"],
                "rationale": "User supplies examples; labels need short justification.",
            },
        }
    )
    answers = [
        {"question_id": "examples", "question": "Do you have examples?", "answer": "Yes, my own"},
        {"question_id": "tone", "question": "Which tone?", "answer": "", "skipped": True},
    ]
    response = api(provider).post("/api/next-question", json=body(answers))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["done"] is False and data["asked"] == 2 and data["limit"] == 5
    assert data["question"]["id"] == "Example_count"
    assert data["question"]["choices"] == ["One", "Two or three", "Five", "Ten"]
    prompting = data["methodology"]["prompting"]
    assert prompting["examples"] == "few_shot" and prompting["example_source"] == "user_supplied"
    assert prompting["reasoning"] == "chain_of_thought"
    sent = json.loads(provider.calls[0]["user"])
    assert sent["interview_so_far"][0]["answer"] == "Yes, my own"
    assert sent["interview_so_far"][1] == {
        "question_id": "tone",
        "question": "Which tone?",
        "answer": None,
        "skipped": True,
    }
    assert "2 asked so far" in provider.calls[0]["system"]


def test_next_question_ids_never_collide_with_previous_questions() -> None:
    provider = ScriptedOpenRouter(
        {
            "done": False,
            "question": {
                "id": "audience",
                "question": "Who reads the labels?",
                "relevance": "Scope.",
                "choices": [],
            },
            "strategy": {},
        }
    )
    answers = [{"question_id": "audience", "question": "Who sends the emails?", "answer": "Customers"}]
    data = api(provider).post("/api/next-question", json=body(answers)).json()
    assert data["question"]["id"] == "audience_2"


def test_repeated_question_or_done_finishes_interview() -> None:
    repeat = ScriptedOpenRouter(
        {
            "done": False,
            "question": {
                "id": "x",
                "question": "Do you have examples?",
                "relevance": "r",
                "choices": ["a", "b"],
            },
            "strategy": {"example_count": 0},
        }
    )
    answers = [{"question_id": "examples", "question": "Do you have EXAMPLES", "answer": "No"}]
    data = api(repeat).post("/api/next-question", json=body(answers)).json()
    assert data["done"] is True and data["question"] is None
    assert data["methodology"]["prompting"]["examples"] == "zero_shot"
    finished = ScriptedOpenRouter(
        {"done": True, "reason": "Enough context.", "question": None, "strategy": {}}
    )
    assert api(finished).post("/api/next-question", json=body()).json()["done"] is True


def test_question_limit_stops_without_spending_provider_calls() -> None:
    provider = ScriptedOpenRouter()
    answers = [{"question_id": f"q{i}", "question": f"Question {i}?", "answer": "yes"} for i in range(5)]
    data = api(provider).post("/api/next-question", json=body(answers)).json()
    assert data["done"] is True and data["reason"] == "Question limit reached."
    assert provider.calls == []


def test_generation_accepts_longer_adaptive_interviews() -> None:
    provider = ScriptedOpenRouter(
        {"prompt": "Label each email as billing, bug or feature.", "assumptions": []}
    )
    payload = body(
        [{"question_id": f"q{i}", "question": f"Question {i}?", "answer": "yes"} for i in range(6)]
    )
    assert api(provider).post("/api/generate", json=payload).status_code == 200
    duplicate = body([{"question_id": "q", "question": "Q?", "answer": "a"}] * 2)
    assert api(ScriptedOpenRouter()).post("/api/next-question", json=duplicate).status_code == 422


def test_prompts_teach_one_shot_few_shot_and_chain_of_thought() -> None:
    assert "one-shot" in INTENT_SYSTEM_PROMPT and "few-shot" in INTENT_SYSTEM_PROMPT
    assert '"chain_of_thought"' in INTENT_SYSTEM_PROMPT
    assert "Illustrative examples (generated" in GENERATE_SYSTEM_PROMPT
    assert "few-shot chain-of-thought" in GENERATE_SYSTEM_PROMPT
    rendered = NEXT_QUESTION_SYSTEM_PROMPT.format(limit=5, asked=0)
    assert "multiple choice" in rendered and "5 questions at most" in rendered


def test_technique_requirements_make_the_strategy_concrete() -> None:
    zero = technique_requirements(PromptingStrategy())
    assert zero == ["Zero-shot: include no input/output demonstrations."]
    one_user = technique_requirements(PromptingStrategy(example_count=1, example_source="user_supplied"))
    assert "exactly 1 input/output demonstration " in one_user[0] and "placeholder" in one_user[0]
    few_cot = technique_requirements(
        PromptingStrategy(
            example_count=3, reasoning="chain_of_thought", techniques=["role_prompting", "self_critique"]
        )
    )
    assert "exactly 3 input/output demonstrations" in few_cot[0] and ILLUSTRATIVE_HEADING in few_cot[0]
    assert few_cot[1].startswith("Chain-of-thought") and "worked steps" in few_cot[1]
    assert few_cot[2].startswith("Open the prompt with a specific, relevant expert role")
    assert len(few_cot) == 4


def test_generation_payload_carries_technique_requirements() -> None:
    request = GenerateRequest.model_validate(body())
    payload = json.loads(generation_user_prompt(request))
    assert payload["technique_requirements"][0].startswith("few_shot: include exactly 3")
    assert "technique_requirements exactly" in GENERATE_SYSTEM_PROMPT
