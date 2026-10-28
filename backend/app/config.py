import secrets
from functools import lru_cache
from pathlib import Path

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
PLACEHOLDERS = {"", "YOUR_GNANI_API_KEY_HERE", "YOUR_OPENROUTER_API_KEY_HERE"}
PLACEHOLDERS |= {"YOUR_REAL_KEY", "YOUR_GNANI_API_KEY", "YOUR_OPENROUTER_API_KEY"}


def local_token() -> str:
    path = ROOT_ENV.with_name(".backend-token")
    try:
        with path.open("x", encoding="utf-8") as handle:
            handle.write(secrets.token_urlsafe(32))
        path.chmod(0o600)
    except FileExistsError:
        pass
    return path.read_text(encoding="utf-8").strip()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_ENV,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    gnani_api_key: str = "YOUR_GNANI_API_KEY_HERE"
    gnani_stt_url: str = "https://api.vachana.ai/stt/v3"
    gnani_language_code: str = "en-IN"
    gnani_stt_format: str = "transcribe"

    openrouter_api_key: str = "YOUR_OPENROUTER_API_KEY_HERE"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_timeout_seconds: int = Field(default=45, ge=5, le=120)

    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    log_level: str = "info"
    app_env: str = "development"
    frontend_url: str = "http://localhost:5173"
    backend_token: str = Field(default_factory=local_token, min_length=24, max_length=256)
    max_concurrent_requests: int = Field(default=3, ge=1, le=10)
    max_requests_per_minute: int = Field(default=30, ge=3, le=300)

    max_audio_duration_seconds: int = Field(default=30, ge=1, le=30)
    max_audio_size_mb: int = Field(default=15, ge=1, le=25)
    max_followup_questions: int = Field(default=3, ge=0, le=3)

    @field_validator("max_audio_duration_seconds", mode="before")
    @classmethod
    def provider_duration_limit(cls, value):
        # Existing .env files used 60; retain compatibility while enforcing the
        # current Gnani REST contract before spending provider quota.
        return min(int(value), 30)

    @field_validator("host")
    @classmethod
    def loopback_only(cls, value: str) -> str:
        if value not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError("HOST must be a loopback address for the local MVP")
        return value

    @computed_field
    @property
    def gnani_configured(self) -> bool:
        return self.gnani_api_key not in PLACEHOLDERS

    @computed_field
    @property
    def openrouter_configured(self) -> bool:
        return self.openrouter_api_key not in PLACEHOLDERS


@lru_cache
def get_settings() -> Settings:
    return Settings()
