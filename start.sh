#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Add provider keys before live API use."
fi

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi

.venv/bin/python -m pip install -r backend/requirements.txt
(cd extension && npm install && npm run build)

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Warning: FFmpeg is not on PATH. Typed prompts work, but WebM voice conversion will fail." >&2
fi

cd backend
exec ../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
