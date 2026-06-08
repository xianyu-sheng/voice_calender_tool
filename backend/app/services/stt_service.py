"""
Offline speech-to-text service based on Vosk.

The frontend records 16 kHz mono PCM WAV. This service loads the local
Chinese Vosk model and feeds the WAV frames directly to KaldiRecognizer.
"""
import json
import hashlib
import os
import shutil
import sys
import tempfile
import wave
from pathlib import Path
from typing import Optional

from vosk import KaldiRecognizer, Model, SetLogLevel

MODEL_NAME = "vosk-model-small-cn-0.22"
MODEL_ENV = "VOSK_MODEL_PATH"

_model: Optional[Model] = None
_model_path: Optional[Path] = None


def _base_paths() -> list[Path]:
    paths: list[Path] = []

    if getattr(sys, "frozen", False):
        paths.append(Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent)))

    service_file = Path(__file__).resolve()
    backend_dir = service_file.parents[2]
    project_dir = backend_dir.parent
    paths.extend([backend_dir, project_dir])
    return paths


def get_model_path() -> Path:
    env_path = os.environ.get(MODEL_ENV)
    candidates: list[Path] = []

    if env_path:
        candidates.append(Path(env_path))

    for base in _base_paths():
        candidates.extend([
            base / "vosk-model" / MODEL_NAME,
            base / "backend" / "vosk-model" / MODEL_NAME,
        ])

    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            return candidate

    searched = "\n".join(str(path) for path in candidates)
    raise FileNotFoundError(
        f"Vosk model not found. Set {MODEL_ENV} or place the model at "
        f"backend/vosk-model/{MODEL_NAME}.\nSearched:\n{searched}"
    )


def get_model() -> Model:
    global _model, _model_path

    source_model_path = get_model_path()
    model_path = get_vosk_runtime_model_path(source_model_path)
    if _model is None or _model_path != model_path:
        SetLogLevel(-1)
        print(f"[STT] Loading Vosk model: {model_path}")
        _model = Model(str(model_path))
        _model_path = model_path
        print("[STT] Vosk model loaded")

    return _model


def get_vosk_runtime_model_path(model_path: Path) -> Path:
    """Return a Vosk-compatible model path.

    On Windows, Vosk can fail when the model lives under a non-ASCII path.
    The project often lives in a Chinese directory, so we mirror the model
    once into an ASCII temp cache and load Vosk from there.
    """
    path_text = str(model_path)
    try:
        path_text.encode("ascii")
        return model_path
    except UnicodeEncodeError:
        pass

    if os.name != "nt":
        return model_path

    digest = hashlib.sha1(path_text.encode("utf-8")).hexdigest()[:12]
    cache_root = Path(tempfile.gettempdir()) / "voice_calendar_vosk"
    cache_path = cache_root / f"{MODEL_NAME}-{digest}"

    if _looks_like_vosk_model(cache_path):
        return cache_path

    cache_root.mkdir(parents=True, exist_ok=True)
    print(f"[STT] Mirroring Vosk model to ASCII cache: {cache_path}")
    shutil.copytree(model_path, cache_path, dirs_exist_ok=True)
    return cache_path


def _looks_like_vosk_model(path: Path) -> bool:
    return (
        (path / "am" / "final.mdl").exists()
        and (path / "conf" / "model.conf").exists()
        and (path / "graph").exists()
    )


def _extract_text(result_json: str) -> str:
    try:
        data = json.loads(result_json)
    except json.JSONDecodeError:
        return ""
    return data.get("text", "").strip()


def transcribe_audio(audio_data: bytes, mime_type: str = "audio/wav") -> Optional[str]:
    """Transcribe WAV audio bytes with the local Vosk model."""
    if not audio_data:
        return None

    try:
        model = get_model()
    except FileNotFoundError:
        raise
    except Exception as e:
        raise RuntimeError(f"failed to load Vosk model: {e}") from e

    try:
        with wave.open(PathLikeBytes(audio_data), "rb") as wf:
            channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            sample_rate = wf.getframerate()
            frame_count = wf.getnframes()
            duration = frame_count / max(sample_rate, 1)

            print(
                f"[STT] Audio: {sample_rate}Hz, {channels}ch, "
                f"{sample_width * 8}bit, {duration:.1f}s"
            )

            if channels != 1:
                raise ValueError("audio must be mono")
            if sample_width != 2:
                raise ValueError("audio must be 16-bit PCM WAV")
            if duration < 0.3:
                return None

            recognizer = KaldiRecognizer(model, sample_rate)
            recognizer.SetWords(False)

            chunks: list[str] = []
            while True:
                data = wf.readframes(4000)
                if not data:
                    break
                if recognizer.AcceptWaveform(data):
                    text = _extract_text(recognizer.Result())
                    if text:
                        chunks.append(text)

            final_text = _extract_text(recognizer.FinalResult())
            if final_text:
                chunks.append(final_text)

            text = " ".join(chunks).strip()
            print(f"[STT] Recognized: {text}")
            return text or None

    except wave.Error as e:
        raise ValueError(f"invalid WAV audio: {e}") from e


class PathLikeBytes:
    """Small file-like adapter so wave.open can read bytes without temp files."""

    def __init__(self, data: bytes):
        from io import BytesIO

        self._buffer = BytesIO(data)

    def read(self, size: int = -1) -> bytes:
        return self._buffer.read(size)

    def seek(self, offset: int, whence: int = 0) -> int:
        return self._buffer.seek(offset, whence)

    def tell(self) -> int:
        return self._buffer.tell()

    def close(self) -> None:
        self._buffer.close()
