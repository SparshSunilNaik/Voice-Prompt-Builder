import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import ROOT_ENV, Settings
from app.main import create_app


def test_root_env_is_project_root() -> None:
    assert ROOT_ENV.name == ".env"
    assert ROOT_ENV.parent.name == "Gnani" or ROOT_ENV.parent.joinpath(".gitignore").exists()


def test_placeholders_are_not_configured() -> None:
    settings = Settings(_env_file=None)
    assert settings.gnani_configured is False
    assert settings.openrouter_configured is False


def test_health_does_not_expose_secrets() -> None:
    response = TestClient(create_app()).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "api_key" not in response.text.lower()
    assert response.headers["cache-control"] == "no-store"


def test_backend_cannot_bind_to_a_public_interface() -> None:
    with pytest.raises(ValidationError, match="loopback"):
        Settings(_env_file=None, host="0.0.0.0")
