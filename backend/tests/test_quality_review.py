import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.dependencies import get_openrouter
from app.config import get_settings
from app.main import create_app
from app.models.contracts import (
    PromptingStrategy,
    PromptQualityReview,
    QualityIssue,
    ReviewRequest,
    ReviewVerification,
    UsageMetadata,
)
from app.services.prompt_engine import review_user_prompt
from app.services.quality import review_prompt


def context():
    method = {
        "name": "Structured plan",
        "description": "Produce a practical plan",
        "rationale": "Planning task",
    }
    return {
        "input": "Plan an e-commerce website for women",
        "analysis": {
            "goal": "Plan an e-commerce website",
            "intended_output": "Plan",
            "domain": "business",
            "methodology": method,
        },
        "methodology": method,
        "prompt": "Create an e-commerce website plan for women.",
    }


def test_strategy_dimensions_combine_and_iteration_limit_is_enforced():
    strategy = PromptingStrategy(
        example_count=2, reasoning="decompose_and_verify", execution="bounded_iteration", max_iterations=3
    )
    assert strategy.examples == "few_shot"
    assert strategy.execution == "bounded_iteration"
    with pytest.raises(ValidationError):
        PromptingStrategy(max_iterations=99)
    with pytest.raises(ValidationError):
        PromptingStrategy(example_count=99)
    assert PromptingStrategy(example_count=0).examples == "zero_shot"
    assert PromptingStrategy(example_count=1).examples == "one_shot"


def test_review_keeps_candidate_separate_from_confirmed_answers():
    request = ReviewRequest(
        **context(), answers=[{"question_id": "q1", "question": "Which market?", "answer": "India"}]
    )
    payload = review_user_prompt(request)
    assert f"<CANDIDATE_PROMPT>\n{request.prompt}\n</CANDIDATE_PROMPT>" in payload
    assert '"question": "Which market?"' in payload


def test_quality_review_route_uses_edited_candidate_and_returns_actionable_report():
    class Reviewer:
        async def structured(self, schema, **kwargs):
            assert schema is PromptQualityReview
            assert f"<CANDIDATE_PROMPT>\n{context()['prompt']}\n</CANDIDATE_PROMPT>" in kwargs["user"]
            return (
                PromptQualityReview(
                    verdict="needs_input",
                    missing_inputs=["Target country"],
                    recommended_strategy=PromptingStrategy(reasoning="decompose_and_verify"),
                ),
                UsageMetadata(total_tokens=20),
                "mock/model",
            )

    app = create_app()
    app.dependency_overrides[get_openrouter] = Reviewer
    client = TestClient(app, headers={"Authorization": f"Bearer {get_settings().backend_token}"})
    response = client.post("/api/review", json=context())
    assert response.status_code == 200
    assert response.json()["report"]["verdict"] == "needs_input"
    assert response.json()["report"]["recommended_strategy"]["execution"] == "single_pass"


@pytest.mark.asyncio
async def test_issue_cross_check_rejects_a_false_alarm_and_aggregates_usage():
    class Reviewer:
        async def structured(self, schema, **kwargs):
            if schema is PromptQualityReview:
                return (
                    PromptQualityReview(
                        verdict="needs_revision",
                        recommended_strategy=PromptingStrategy(),
                        issues=[
                            QualityIssue(
                                severity="high",
                                issue="No fallback for unknown budget",
                                improvement="Provide conditional options",
                                evidence="unknown budget",
                            )
                        ],
                    ),
                    UsageMetadata(total_tokens=10),
                    "mock/model",
                )
            assert schema is ReviewVerification
            return (
                ReviewVerification(
                    verdict="ready",
                    checks=[
                        {
                            "issue_index": 0,
                            "supported": False,
                            "reason": "Conditional options are already provided.",
                        }
                    ],
                ),
                UsageMetadata(total_tokens=5),
                "mock/model",
            )

    report, usage, _ = await review_prompt(ReviewRequest(**context()), Reviewer())
    assert report.verdict == "ready"
    assert report.issues == []
    assert report.review_notes
    assert usage.total_tokens == 15


@pytest.mark.asyncio
async def test_issue_cross_check_must_cover_every_issue_before_returning_a_verdict():
    from app.core.errors import ProviderError

    class Reviewer:
        async def structured(self, schema, **kwargs):
            if schema is PromptQualityReview:
                return (
                    PromptQualityReview(
                        verdict="needs_revision",
                        recommended_strategy=PromptingStrategy(),
                        issues=[
                            QualityIssue(
                                severity="medium", issue="Missing output", improvement="State output"
                            )
                        ],
                    ),
                    UsageMetadata(),
                    "mock",
                )
            return ReviewVerification(verdict="ready", checks=[]), UsageMetadata(), "mock"

    with pytest.raises(ProviderError, match="incomplete"):
        await review_prompt(ReviewRequest(**context()), Reviewer())
