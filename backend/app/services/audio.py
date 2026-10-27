import asyncio
import io
import shutil
import tempfile
import wave
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
    content: bytes,
    filename: str,
    content_type: str,
    max_size_mb: int,
    max_duration_seconds: int = 60,
) -> NormalizedAudio:
    suffix = validate_audio(content, filename, content_type, max_size_mb)
    if suffix == ".wav":
        validate_wav_duration(content, max_duration_seconds)
    if suffix in SUPPORTED_EXTENSIONS:
        return NormalizedAudio(content, f"recording{suffix}", content_type or "application/octet-stream")
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
        await process.communicate()
        if process.returncode or not target.exists():
            raise AppError("Could not decode recording", status_code=422, code="invalid_audio")
        output = target.read_bytes()
        validate_wav_duration(output, max_duration_seconds)
        return NormalizedAudio(output, "recording.wav", "audio/wav")


def validate_wav_duration(content: bytes, max_duration_seconds: int) -> None:
    try:
        with wave.open(io.BytesIO(content), "rb") as recording:
            frame_rate = recording.getframerate()
            duration = recording.getnframes() / frame_rate if frame_rate else 0
    except (EOFError, wave.Error) as exc:
        raise AppError("Invalid WAV recording", status_code=422, code="invalid_audio") from exc
    if duration > max_duration_seconds:
        raise AppError(
            f"Recording exceeds the {max_duration_seconds}-second duration limit",
            status_code=413,
            code="audio_too_long",
        )
