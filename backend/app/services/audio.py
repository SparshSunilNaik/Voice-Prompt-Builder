import asyncio
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.core.errors import AppError

SUPPORTED_EXTENSIONS = {".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a"}
WEBM_EXTENSIONS = {".webm"}
MIME_EXTENSIONS = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/flac": ".flac",
    "audio/aac": ".aac",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/webm": ".webm",
}


@dataclass(frozen=True)
class NormalizedAudio:
    content: bytes
    filename: str
    content_type: str


def validate_audio(content: bytes, filename: str, content_type: str, max_size_mb: int) -> str:
    if not content:
        raise AppError("Recording is empty", status_code=422, code="invalid_audio")
    if len(content) > max_size_mb * 1024 * 1024:
        raise AppError("Recording exceeds the size limit", status_code=413, code="audio_too_large")
    suffix = Path(filename).suffix.lower() or MIME_EXTENSIONS.get(content_type.split(";")[0], "")
    if suffix not in SUPPORTED_EXTENSIONS | WEBM_EXTENSIONS:
        raise AppError("Unsupported audio format", status_code=415, code="unsupported_audio")
    return suffix


async def normalize_audio(
    content: bytes, filename: str, content_type: str, max_size_mb: int
) -> NormalizedAudio:
    suffix = validate_audio(content, filename, content_type, max_size_mb)
    if suffix in SUPPORTED_EXTENSIONS:
        return NormalizedAudio(
            content, f"recording{suffix}", content_type or "application/octet-stream"
        )
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise AppError(
            "WebM recording conversion requires FFmpeg on the backend",
            status_code=503,
            code="ffmpeg_unavailable",
        )
    with tempfile.TemporaryDirectory(prefix="voice-prompt-") as directory:
        source, target = Path(directory) / "input.webm", Path(directory) / "output.wav"
        source.write_bytes(content)
        process = await asyncio.create_subprocess_exec(
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(target),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()
        if process.returncode or not target.exists():
            raise AppError(
                f"Could not decode recording: {stderr.decode(errors='ignore')[:160]}",
                status_code=422,
                code="invalid_audio",
            )
        return NormalizedAudio(target.read_bytes(), "recording.wav", "audio/wav")
