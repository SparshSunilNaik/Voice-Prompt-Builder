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
    max_duration_seconds: int = 30,
) -> NormalizedAudio:
    suffix = validate_audio(content, filename, content_type, max_size_mb)
    if suffix == ".wav":
        validate_wav_duration(content, max_duration_seconds)
        return NormalizedAudio(content, "recording.wav", "audio/wav")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise AppError(
            "Audio decoding requires FFmpeg on the backend",
            status_code=503,
            code="ffmpeg_unavailable",
        )
    with tempfile.TemporaryDirectory(prefix="voice-prompt-") as directory:
        source, target = Path(directory) / f"input{suffix}", Path(directory) / "output.wav"
        source.write_bytes(content)
        process = await asyncio.create_subprocess_exec(
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-nostdin",
            "-protocol_whitelist",
            "file,pipe",
            "-f",
            {
                ".webm": "matroska",
                ".mp3": "mp3",
                ".ogg": "ogg",
                ".flac": "flac",
                ".aac": "aac",
                ".m4a": "mov",
            }[suffix],
            "-i",
            str(source),
            "-t",
            str(max_duration_seconds + 1),
            "-fs",
            str((max_duration_seconds + 2) * 32000),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(target),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            await asyncio.wait_for(process.wait(), timeout=20)
        except TimeoutError as exc:
            if process.returncode is None:
                process.kill()
            await process.wait()
            raise AppError("Audio decoding took too long", status_code=422, code="audio_timeout") from exc
        except BaseException:
            if process.returncode is None:
                process.kill()
            await process.wait()
            raise
        if process.returncode or not target.exists():
            raise AppError("Could not decode recording", status_code=422, code="invalid_audio")
        output = target.read_bytes()
        # Browser stop events can arrive slightly after the recording timer. Trim
        # only that small WebM overrun, while still rejecting genuinely long uploads.
        if suffix == ".webm":
            with wave.open(io.BytesIO(output), "rb") as decoded:
                duration = decoded.getnframes() / decoded.getframerate()
                if max_duration_seconds < duration <= max_duration_seconds + 0.75:
                    frames = decoded.readframes(max_duration_seconds * decoded.getframerate())
                    trimmed = io.BytesIO()
                    with wave.open(trimmed, "wb") as recording:
                        recording.setparams(decoded.getparams())
                        recording.writeframes(frames)
                    output = trimmed.getvalue()
        validate_wav_duration(output, max_duration_seconds)
        return NormalizedAudio(output, "recording.wav", "audio/wav")


def validate_wav_duration(content: bytes, max_duration_seconds: int) -> None:
    try:
        with wave.open(io.BytesIO(content), "rb") as recording:
            frame_rate = recording.getframerate()
            duration = recording.getnframes() / frame_rate if frame_rate else 0
            if (
                not frame_rate
                or recording.getnchannels() not in {1, 2}
                or recording.getsampwidth() not in {1, 2, 3, 4}
            ):
                raise wave.Error("Unsupported PCM structure")
            expected = recording.getnframes() * recording.getnchannels() * recording.getsampwidth()
            if not expected or len(recording.readframes(recording.getnframes())) != expected:
                raise wave.Error("Truncated or empty WAV")
    except (EOFError, wave.Error) as exc:
        raise AppError("Invalid WAV recording", status_code=422, code="invalid_audio") from exc
    if duration > max_duration_seconds:
        raise AppError(
            f"Recording exceeds the {max_duration_seconds}-second duration limit",
            status_code=413,
            code="audio_too_long",
        )
