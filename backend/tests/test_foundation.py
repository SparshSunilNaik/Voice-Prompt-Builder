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


def test_configuration_loads_credentials_from_an_explicit_env_file(tmp_path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "OPENROUTER_API_KEY=synthetic-openrouter-key\n"
        "GNANI_API_KEY=synthetic-gnani-key\n"
        "OPENROUTER_MODEL=test/model\n",
        encoding="utf-8",
    )
    settings = Settings(_env_file=env_file)
    assert settings.openrouter_configured is True
    assert settings.gnani_configured is True
    assert settings.openrouter_model == "test/model"
