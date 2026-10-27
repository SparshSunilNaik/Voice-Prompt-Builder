from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import get_settings
from app.core.errors import AppError
from app.models.contracts import HealthResponse


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Voice Prompt Builder API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_origin_regex=r"chrome-extension://[a-p]{32}",
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Extension-Request"],
    )
    app.include_router(router)

    @app.middleware("http")
    async def browser_origin_guard(request: Request, call_next):
        origin = request.headers.get("origin")
        if request.url.path.startswith("/api/") and origin:
            allowed = origin == settings.frontend_url or origin.startswith("chrome-extension://")
            extension_marked = request.headers.get("x-extension-request") == "1"
            if not allowed or (origin.startswith("chrome-extension://") and not extension_marked):
                return JSONResponse(
                    status_code=403,
                    content={"error": {"code": "origin_forbidden", "message": "Origin not allowed"}},
                )
        return await call_next(request)

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, error: AppError):
        return JSONResponse(
            status_code=error.status_code,
            content={"error": {"code": error.code, "message": error.message}},
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
