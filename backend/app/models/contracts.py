from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    environment: str
    services: dict[str, bool]


class Methodology(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=1000)
    rationale: str = Field(min_length=1, max_length=1000)


class FollowUpQuestion(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]+$")
    question: str = Field(min_length=1, max_length=500)
    relevance: str = Field(min_length=1, max_length=500)
    choices: list[str] = Field(default_factory=list, max_length=6)
    skippable: bool = True


class IntentAnalysis(BaseModel):
    goal: str
    context: str = ""
    intended_output: str
    known_requirements: list[str] = Field(default_factory=list)
    missing_requirements: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    domain: str
    ambiguity: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    methodology: Methodology
    alternatives: list[Methodology] = Field(default_factory=list, max_length=3)


class UsageMetadata(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
