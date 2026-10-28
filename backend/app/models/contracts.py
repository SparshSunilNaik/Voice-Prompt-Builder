from typing import Annotated, Literal

from pydantic import BaseModel, Field, computed_field, model_validator

Text = Annotated[str, Field(max_length=2000)]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    environment: str
    services: dict[str, bool]


class PromptingStrategy(BaseModel):
    example_count: int = Field(default=0, ge=0, le=5)
    reasoning: Literal["direct", "decompose_and_verify"] = "direct"
    execution: Literal["single_pass", "bounded_iteration"] = "single_pass"
    max_iterations: int = Field(default=3, ge=1, le=5)
    rationale: str = Field(default="Start with the simplest sufficient instructions.", max_length=1200)
    example_requirement: str = Field(default="No reference examples required.", max_length=1000)
    success_criteria: list[Text] = Field(default_factory=list, max_length=8)

    @computed_field
    @property
    def examples(self) -> Literal["zero_shot", "one_shot", "few_shot"]:
        return (
            "zero_shot" if self.example_count == 0 else "one_shot" if self.example_count == 1 else "few_shot"
        )

    @model_validator(mode="after")
    def consistent_strategy(self):
        if self.example_count == 0:
            self.example_requirement = "No reference examples required."
        if self.execution == "single_pass":
            self.max_iterations = 1
        return self


class Methodology(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1000)
    rationale: str = Field(min_length=1, max_length=1000)
    prompting: PromptingStrategy = Field(default_factory=PromptingStrategy)


class FollowUpQuestion(BaseModel):
    id: str = Field(max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    question: str = Field(min_length=1, max_length=500)
    relevance: str = Field(min_length=1, max_length=500)
    choices: list[Annotated[str, Field(max_length=300)]] = Field(default_factory=list, max_length=6)
    skippable: bool = True


class IntentAnalysis(BaseModel):
    goal: Text
    context: Text = ""
    intended_output: Text
    known_requirements: list[Text] = Field(default_factory=list, max_length=30)
    missing_requirements: list[Text] = Field(default_factory=list, max_length=30)
    constraints: list[Text] = Field(default_factory=list, max_length=30)
    domain: Text
    ambiguity: list[Text] = Field(default_factory=list, max_length=30)
    risks: list[Text] = Field(default_factory=list, max_length=30)
    methodology: Methodology
    alternatives: list[Methodology] = Field(default_factory=list, max_length=3)


class UsageMetadata(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class AnalyzeRequest(BaseModel):
    input: str = Field(min_length=3, max_length=20_000)


class AnalyzeResponse(BaseModel):
    analysis: IntentAnalysis
    usage: UsageMetadata = Field(default_factory=UsageMetadata)
    model: str


class RefineRequest(BaseModel):
    input: str = Field(min_length=3, max_length=20_000)
    analysis: IntentAnalysis
    methodology: Methodology
    custom_instructions: str = Field(default="", max_length=5000)


class FollowUpSet(BaseModel):
    questions: list[FollowUpQuestion] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def unique_question_ids(self):
        ids = [question.id for question in self.questions]
        if len(ids) != len(set(ids)):
            raise ValueError("Follow-up question IDs must be unique")
        return self


class RefineResponse(BaseModel):
    questions: list[FollowUpQuestion]
    usage: UsageMetadata = Field(default_factory=UsageMetadata)
    model: str


class FollowUpAnswer(BaseModel):
    question_id: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(default="", max_length=5000)
    skipped: bool = False


class GenerateRequest(BaseModel):
    input: str = Field(min_length=3, max_length=20_000)
    analysis: IntentAnalysis
    methodology: Methodology
    answers: list[FollowUpAnswer] = Field(default_factory=list, max_length=3)
    custom_instructions: str = Field(default="", max_length=5000)
    previous_prompt: str = Field(default="", max_length=30_000)
    revision_request: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def unique_answer_ids(self):
        ids = [answer.question_id for answer in self.answers]
        if len(ids) != len(set(ids)):
            raise ValueError("Follow-up answers must reference unique questions")
        return self


class GeneratedPrompt(BaseModel):
    prompt: str = Field(min_length=10, max_length=30_000)
    assumptions: list[Text] = Field(default_factory=list, max_length=20)


class ReviewRequest(GenerateRequest):
    prompt: str = Field(min_length=10, max_length=30_000)


class QualityIssue(BaseModel):
    severity: Literal["high", "medium", "low"]
    issue: Text
    improvement: Text
    evidence: str = Field(default="", max_length=1200)


class PromptQualityReview(BaseModel):
    verdict: Literal["ready", "needs_revision", "needs_input"]
    strengths: list[Text] = Field(default_factory=list, max_length=6)
    issues: list[QualityIssue] = Field(default_factory=list, max_length=8)
    missing_inputs: list[Text] = Field(default_factory=list, max_length=6)
    recommended_strategy: PromptingStrategy
    review_notes: list[Text] = Field(default_factory=list, max_length=8)


class IssueVerification(BaseModel):
    issue_index: int = Field(ge=0, le=7)
    supported: bool
    reason: Text


class ReviewVerification(BaseModel):
    verdict: Literal["ready", "needs_revision", "needs_input"]
    checks: list[IssueVerification] = Field(default_factory=list, max_length=8)
    blocking_missing_inputs: list[Text] = Field(default_factory=list, max_length=6)


class ReviewResponse(BaseModel):
    report: PromptQualityReview
    usage: UsageMetadata = Field(default_factory=UsageMetadata)
    model: str


class GenerateResponse(BaseModel):
    prompt: str
    assumptions: list[str]
    usage: UsageMetadata = Field(default_factory=UsageMetadata)
    model: str


class TranscriptionResponse(BaseModel):
    transcript: str
    request_id: str | None = None
