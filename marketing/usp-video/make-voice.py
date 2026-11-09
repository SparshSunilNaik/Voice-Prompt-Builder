"""Generate the voice-over clips in narration.json and the timeline that render.mjs syncs to.

Usage (needs `pip install edge-tts` and ffprobe on PATH; sends the script text to Microsoft's TTS service):
    python make-voice.py

Each clip has an `at` time on the original 30 s animation timeline. Clips never overlap: when a clip
would start before the previous one finishes, that stretch of the animation is slowed down to make room.
Writes voice/<id>.wav and voice/timeline.json ({anchors: [[design, real], ...], clips: [...], duration}).
"""
import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

HERE = Path(__file__).resolve().parent
OUT = HERE / "voice"
GAP = 0.18  # silence between consecutive clips (s)
DESIGN_END = 30.0
TAIL = 1.4  # hold the end card after the last word (s)


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def trim(raw: Path, path: Path) -> None:
    """Strip the leading/trailing silence the TTS service pads every clip with."""
    cut = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af",
         f"{cut},areverse,{cut},areverse,apad=pad_dur=0.04", "-ar", "48000", "-ac", "1", str(path)],
        check=True,
    )
    raw.unlink()


async def synth(text: str, voice: str, rate: str, path: Path) -> None:
    for attempt in range(4):  # the service occasionally returns no audio; retry
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(str(path))
            return
        except edge_tts.exceptions.NoAudioReceived:
            if attempt == 3:
                raise
            await asyncio.sleep(1.5)


async def main() -> None:
    spec = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)
    clips = []
    for clip in spec["clips"]:
        voice = spec["voices"][clip["who"]]
        raw = OUT / f"{clip['id']}.raw.mp3"
        path = OUT / f"{clip['id']}.wav"
        await synth(clip["text"], voice["voice"], voice["rate"], raw)
        trim(raw, path)
        clips.append({**clip, "file": path.name, "length": round(duration(path), 3)})

    anchors = [[0.0, 0.0]]
    prev_design, prev_real, busy_until = 0.0, 0.0, 0.0
    for clip in clips:
        real = max(prev_real + (clip["at"] - prev_design), busy_until + GAP)
        clip["start"] = round(real, 3)
        anchors.append([clip["at"], round(real, 3)])
        prev_design, prev_real = clip["at"], real
        busy_until = real + clip["length"]
    end = max(prev_real + (DESIGN_END - prev_design), busy_until + TAIL)
    anchors.append([DESIGN_END, round(end, 3)])

    timeline = {"anchors": anchors, "clips": clips, "duration": round(end, 3)}
    (OUT / "timeline.json").write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    for clip in clips:
        print(f"{clip['id']} {clip['who']:<8} at {clip['start']:6.2f}s  len {clip['length']:.2f}s  {clip['text']}")
    print(f"video length {end:.2f}s")


asyncio.run(main())
