from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models.contracts import HealthResponse


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Voice Prompt Builder API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Extension-Request"],
    )

    @app.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(
            environment=settings.app_env,
            services={
                "gnani_configured": settings.gnani_configured,
                "openrouter_configured": settings.openrouter_configured,
            },
        )

    return app


app = create_app()
