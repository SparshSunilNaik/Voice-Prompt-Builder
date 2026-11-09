import re

from fastapi import APIRouter, Depends, File, UploadFile

from app.api.dependencies import get_gnani, get_openrouter
from app.config import Settings, get_settings
from app.models.contracts import (
    AnalyzeRequest,
    AnalyzeResponse,
    FollowUpQuestion,
    FollowUpSet,
    GeneratedPrompt,
    GenerateRequest,
    GenerateResponse,
    IntentAnalysis,
    NextQuestionDecision,
    NextQuestionRequest,
    NextQuestionResponse,
    RefineRequest,
    RefineResponse,
    ReviewRequest,
    ReviewResponse,
    TranscriptionResponse,
)
from app.services.audio import normalize_audio
from app.services.gnani import GnaniClient
from app.services.interview import (
    apply_stated_example_choice,
    clean_choices,
    is_repeat,
    label_illustrative_examples,
)
from app.services.openrouter import OpenRouterClient
from app.services.prompt_engine import (
    FOLLOWUP_SYSTEM_PROMPT,
    GENERATE_SYSTEM_PROMPT,
    INTENT_SYSTEM_PROMPT,
    NEXT_QUESTION_SYSTEM_PROMPT,
    analysis_user_prompt,
    followup_user_prompt,
    generation_user_prompt,
    next_question_user_prompt,
)
from app.services.quality import review_prompt

router = APIRouter(prefix="/api")


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    audio: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    gnani: GnaniClient = Depends(get_gnani),
) -> TranscriptionResponse:
    content = await audio.read(settings.max_audio_size_mb * 1024 * 1024 + 1)
    normalized = await normalize_audio(
        content,
        audio.filename or "recording",
        audio.content_type or "",
        settings.max_audio_size_mb,
        settings.max_audio_duration_seconds,
    )
    result = await gnani.transcribe(normalized)
    return TranscriptionResponse(transcript=result.transcript, request_id=result.request_id)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    request: AnalyzeRequest, openrouter: OpenRouterClient = Depends(get_openrouter)
) -> AnalyzeResponse:
    result, usage, model = await openrouter.structured(
        IntentAnalysis,
        schema_name="intent_analysis",
        system=INTENT_SYSTEM_PROMPT,
        user=analysis_user_prompt(request.input, request.learned_feedback),
    )
    return AnalyzeResponse(analysis=result, usage=usage, model=model)


@router.post("/refine", response_model=RefineResponse)
async def refine(
    request: RefineRequest,
    settings: Settings = Depends(get_settings),
    openrouter: OpenRouterClient = Depends(get_openrouter),
) -> RefineResponse:
    result, usage, model = await openrouter.structured(
        FollowUpSet,
        schema_name="follow_up_questions",
        system=FOLLOWUP_SYSTEM_PROMPT.format(limit=settings.max_followup_questions),
        user=followup_user_prompt(request),
    )
    return RefineResponse(
        questions=result.questions[: settings.max_followup_questions], usage=usage, model=model
    )


def _question_id(raw: str, taken: set[str]) -> str:
    base = re.sub(r"[^a-zA-Z0-9_-]+", "_", raw.strip()).strip("_")[:60] or "question"
    candidate, suffix = base, 2
    while candidate in taken:
        candidate, suffix = f"{base}_{suffix}", suffix + 1
    return candidate


@router.post("/next-question", response_model=NextQuestionResponse)
async def next_question(
    request: NextQuestionRequest,
    settings: Settings = Depends(get_settings),
    openrouter: OpenRouterClient = Depends(get_openrouter),
) -> NextQuestionResponse:
    """Ask one question at a time, adapting each to the answers given so far."""
    limit = settings.max_adaptive_questions
    asked = len(request.answers)
    if asked >= limit:
        return NextQuestionResponse(
            done=True,
            methodology=request.methodology,
            reason="Question limit reached.",
            asked=asked,
            limit=limit,
            model="none",
        )
    decision, usage, model = await openrouter.structured(
        NextQuestionDecision,
        schema_name="next_clarifying_question",
        system=NEXT_QUESTION_SYSTEM_PROMPT.format(limit=limit, asked=asked),
        user=next_question_user_prompt(request),
    )
    strategy = apply_stated_example_choice(decision.strategy, request.answers)
    methodology = request.methodology.model_copy(update={"prompting": strategy})
    draft = decision.question
    previous = [answer.question for answer in request.answers]
    if decision.done or draft is None or is_repeat(draft.question, previous):
        return NextQuestionResponse(
            done=True,
            methodology=methodology,
            reason=decision.reason,
            asked=asked,
            limit=limit,
            usage=usage,
            model=model,
        )
    choices = clean_choices(draft.choices)
    question = FollowUpQuestion(
        id=_question_id(draft.id, {answer.question_id for answer in request.answers}),
        question=draft.question.strip(),
        relevance=draft.relevance.strip(),
        choices=choices,
    )
    return NextQuestionResponse(
        done=False,
        question=question,
        methodology=methodology,
        reason=decision.reason,
        asked=asked,
        limit=limit,
        usage=usage,
        model=model,
    )


@router.post("/generate", response_model=GenerateResponse)
async def generate(
    request: GenerateRequest, openrouter: OpenRouterClient = Depends(get_openrouter)
) -> GenerateResponse:
    result, usage, model = await openrouter.structured(
        GeneratedPrompt,
        schema_name="generated_prompt",
        system=GENERATE_SYSTEM_PROMPT,
        user=generation_user_prompt(request),
    )
    prompt, note = label_illustrative_examples(result.prompt, request.methodology.prompting)
    assumptions = [*result.assumptions, note] if note else result.assumptions
    return GenerateResponse(prompt=prompt, assumptions=assumptions, usage=usage, model=model)


@router.post("/review", response_model=ReviewResponse)
async def review(
    request: ReviewRequest, openrouter: OpenRouterClient = Depends(get_openrouter)
) -> ReviewResponse:
    report, usage, model = await review_prompt(request, openrouter)
    return ReviewResponse(report=report, usage=usage, model=model)
