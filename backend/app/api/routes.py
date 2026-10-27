import json

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

router = APIRouter(prefix="/api")


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    audio: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    gnani: GnaniClient = Depends(get_gnani),
) -> TranscriptionResponse:
    content = await audio.read(settings.max_audio_size_mb * 1024 * 1024 + 1)
    normalized = await normalize_audio(
        content, audio.filename or "recording", audio.content_type or "", settings.max_audio_size_mb
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
        system=(
            "Analyze rough user requests. Recommend the simplest effective methodology and up to "
            "three viable alternatives. Separate known facts, missing details, constraints, ambiguity, "
            "and risks. Never invent requirements. Return only the requested JSON."
        ),
        user=request.input,
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
        system=(
            f"Ask zero to {settings.max_followup_questions} high-value contextual questions. Do not ask "
            "for facts already supplied. Every question needs a stable unique ID, relevance, optional "
            "concise choices, and must be skippable. Return fewer questions when none are needed."
        ),
        user=request.model_dump_json(),
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
        system=(
            "Create a specific, actionable final prompt. Use only useful sections from objective, "
            "context, role, methodology, requirements, constraints, deliverables, quality standards, "
            "and validation. Mark assumptions explicitly. Respect skipped answers and requested "
            "revisions. Avoid filler and prompt-engineering jargon."
        ),
        user=json.dumps(request.model_dump(), ensure_ascii=False),
    )
    return GenerateResponse(prompt=result.prompt, assumptions=result.assumptions, usage=usage, model=model)
