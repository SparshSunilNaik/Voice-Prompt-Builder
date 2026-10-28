"""Local-only launcher. Display a pairing token, never provider credentials."""

import uvicorn

from app.config import get_settings


def main() -> None:
    settings = get_settings()
    print("Paste this local access token into the extension's Backend connection:", flush=True)
    print(settings.backend_token, flush=True)
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, log_level=settings.log_level)


if __name__ == "__main__":
    main()
