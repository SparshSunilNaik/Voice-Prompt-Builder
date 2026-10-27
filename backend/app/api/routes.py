from fastapi import APIRouter, Depends, File, UploadFile

from app.api.dependencies import get_gnani, get_openrouter
from app.config import Settings, get_settings
from app.models.contracts import (
    AnalyzeRequest,
    AnalyzeResponse,
    FollowUpSet,
    GeneratedPrompt,
    GenerateRequest,
    GenerateResponse,
    IntentAnalysis,
    RefineRequest,
    RefineResponse,
    TranscriptionResponse,
)
from app.services.audio import normalize_audio
from app.services.gnani import GnaniClient
from app.services.openrouter import OpenRouterClient
from app.services.prompt_engine import (
    FOLLOWUP_SYSTEM_PROMPT,
    GENERATE_SYSTEM_PROMPT,
    INTENT_SYSTEM_PROMPT,
    analysis_user_prompt,
    followup_user_prompt,
    generation_user_prompt,
)

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
        user=analysis_user_prompt(request.input),
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
    return GenerateResponse(prompt=result.prompt, assumptions=result.assumptions, usage=usage, model=model)
