import asyncio
import re
import secrets
from collections import deque
from time import monotonic

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes import router
from app.config import get_settings
from app.core.body_limit import BodyLimitMiddleware
from app.core.errors import AppError
from app.models.contracts import HealthResponse


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Voice Prompt Builder API", version="0.3.0")
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_origin_regex=r"^chrome-extension://[a-p]{32}$",
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Extension-Request", "Authorization"],
    )
    app.include_router(router)
    app.add_middleware(BodyLimitMiddleware, audio_bytes=settings.max_audio_size_mb * 1024 * 1024)
    slots = asyncio.Semaphore(settings.max_concurrent_requests)
    recent_requests: deque[float] = deque()

    @app.middleware("http")
    async def browser_origin_guard(request: Request, call_next):
        origin = request.headers.get("origin")
        if request.url.path.startswith("/api/") and origin:
            extension_origin = re.fullmatch(r"chrome-extension://[a-p]{32}", origin) is not None
            allowed = origin == settings.frontend_url or extension_origin
            extension_marked = request.headers.get("x-extension-request") == "1"
            if not allowed or (extension_origin and not extension_marked and request.method != "OPTIONS"):
                return JSONResponse(
                    status_code=403,
                    content={"error": {"code": "origin_forbidden", "message": "Origin not allowed"}},
                )
        if request.url.path.startswith("/api/") and request.method != "OPTIONS":
            if not secrets.compare_digest(
                request.headers.get("authorization", "").encode(), f"Bearer {settings.backend_token}".encode()
            ):
                return JSONResponse(
                    status_code=401,
                    content={
                        "error": {
                            "code": "pairing_required",
                            "message": (
                                "Open Backend connection and paste the local access token "
                                "printed by the startup script."
                            ),
                        }
                    },
                )
            now = monotonic()
            while recent_requests and now - recent_requests[0] >= 60:
                recent_requests.popleft()
            if len(recent_requests) >= settings.max_requests_per_minute:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "local_rate_limit",
                            "message": "Local request limit reached. Wait a minute and retry.",
                        }
                    },
                )
            recent_requests.append(now)
            try:
                await asyncio.wait_for(slots.acquire(), timeout=0.1)
            except TimeoutError:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {"code": "busy", "message": "The backend is busy. Wait briefly and retry."}
                    },
                )
            try:
                async with asyncio.timeout(95):
                    response = await call_next(request)
            except TimeoutError:
                return JSONResponse(
                    status_code=504,
                    content={
                        "error": {
                            "code": "request_timeout",
                            "message": "The request took too long. Retry this step.",
                        }
                    },
                )
            finally:
                slots.release()
        else:
            response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

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
