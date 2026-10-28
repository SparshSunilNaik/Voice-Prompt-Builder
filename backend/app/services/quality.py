import json

from app.core.errors import ProviderError
from app.models.contracts import PromptQualityReview, ReviewRequest, ReviewVerification
from app.services.openrouter import OpenRouterClient
from app.services.prompt_engine import REVIEW_SYSTEM_PROMPT, review_user_prompt

VERIFY_SYSTEM = """Verify each proposed review issue against the actual candidate. Do not generate
new criticisms. For every issue_index, say whether the alleged defect really exists and give a short
evidence-based reason. Mark supported=false if the candidate already does what the improvement asks.
For example, 'cite current official sources or mark checks unverified' already handles source checking;
'ask essential questions; otherwise give conditional options and label unresolved inputs' already
handles unknown country/currency/budget. Lack of supplied values is not a blocking prompt defect
when that fallback exists. Unknown facts can remain unknown in a conditional planning document.
Only retain genuinely blocking missing inputs. Do not demand decisions the planner should propose.
Return one check for EVERY proposed issue, with unique indexes. Ready means adequate instructions,
not guaranteed downstream success. Do not request hidden chain-of-thought. Return schema JSON only."""


async def review_prompt(request: ReviewRequest, provider: OpenRouterClient):
    report, usage, model = await provider.structured(
        PromptQualityReview,
        schema_name="prompt_quality_review",
        system=REVIEW_SYSTEM_PROMPT,
        user=review_user_prompt(request),
    )
    if not report.issues:
        return report, usage, model
    verification, second_usage, _ = await provider.structured(
        ReviewVerification,
        schema_name="review_issue_verification",
        system=VERIFY_SYSTEM,
        user=json.dumps({"candidate_prompt": request.prompt, "proposed_review": report.model_dump()}),
        retries=0,
    )
    indexes = [check.issue_index for check in verification.checks]
    if sorted(indexes) != list(range(len(report.issues))):
        raise ProviderError(
            "The quality review was incomplete. Retry or review the prompt manually.",
            status_code=502,
            code="review_incomplete",
        )
    supported = {check.issue_index for check in verification.checks if check.supported}
    report.issues = [issue for index, issue in enumerate(report.issues) if index in supported]
    report.review_notes = [
        ("The model reviewers disagreed about a proposed issue. Verify it manually: " + check.reason)[:2000]
        for check in verification.checks
        if not check.supported
    ]
    report.missing_inputs = verification.blocking_missing_inputs
    report.verdict = (
        "needs_revision" if report.issues else "needs_input" if report.missing_inputs else "ready"
    )
    usage.prompt_tokens += second_usage.prompt_tokens
    usage.completion_tokens += second_usage.completion_tokens
    usage.total_tokens += second_usage.total_tokens
    return report, usage, model
