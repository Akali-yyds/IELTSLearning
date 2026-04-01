import hashlib
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Optional

from ..config import settings
from .lemmatizer import clean_word
from piper.download_voices import download_voice

BACKEND_DIR = Path(__file__).resolve().parents[2]
AUDIO_CACHE_DIR = BACKEND_DIR / "data" / "generated_audio"
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
PIPER_DATA_DIR = (BACKEND_DIR / settings.piper_data_dir).resolve()
PIPER_DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_audio_cache_dir() -> Path:
    return AUDIO_CACHE_DIR


def _resolve_executable(command: str) -> Optional[str]:
    if not command:
        return None
    if Path(command).exists():
        return str(Path(command))
    return shutil.which(command)


def _build_audio_filename(word: str, variant: str, backend: str) -> str:
    digest = hashlib.sha1(f"{word}|{variant}|{backend}".encode("utf-8")).hexdigest()[:12]
    safe_word = "".join(ch for ch in word if ch.isalnum() or ch in ("-", "_"))[:40] or "word"
    return f"{safe_word}-{variant}-{backend}-{digest}.wav"


def get_piper_data_dir() -> Path:
    return PIPER_DATA_DIR


def _voice_setting(variant: str) -> str:
    return settings.piper_voice_en_gb if variant == "uk" else settings.piper_voice_en_us


def _configured_model_paths(variant: str) -> tuple[str, str]:
    if variant == "uk":
        return settings.piper_model_en_gb, settings.piper_config_en_gb
    return settings.piper_model_en_us, settings.piper_config_en_us


def _default_config_path_for_model(model_path: Path) -> Path:
    return model_path.parent / f"{model_path.name}.json"


@lru_cache(maxsize=4)
def _ensure_piper_voice_files(variant: str) -> tuple[str, str]:
    model_path_str, config_path_str = _configured_model_paths(variant)
    if model_path_str:
        model_path = Path(model_path_str)
        config_path = Path(config_path_str) if config_path_str else _default_config_path_for_model(model_path)
        if model_path.exists():
            return str(model_path), str(config_path) if config_path.exists() else ""

    voice_name = _voice_setting(variant)
    if not voice_name:
        return "", ""

    model_path = PIPER_DATA_DIR / f"{voice_name}.onnx"
    config_path = PIPER_DATA_DIR / f"{voice_name}.onnx.json"

    if not model_path.exists() or not config_path.exists():
        try:
            download_voice(voice_name, PIPER_DATA_DIR)
        except Exception:
            return "", ""

    return (
        str(model_path) if model_path.exists() else "",
        str(config_path) if config_path.exists() else "",
    )


def _espeak_voice(variant: str) -> str:
    return "en-gb" if variant == "uk" else "en-us"


def _generate_with_piper(word: str, output_path: Path, variant: str) -> bool:
    executable = _resolve_executable(settings.piper_path)
    model_path, config_path = _ensure_piper_voice_files(variant)
    if not executable or not model_path:
        return False

    model = Path(model_path)
    if not model.exists():
        return False

    cmd = [
        executable,
        "--model",
        str(model),
        "--output_file",
        str(output_path),
    ]
    if config_path and Path(config_path).exists():
        cmd.extend(["--config", str(Path(config_path))])

    try:
        subprocess.run(
            cmd,
            input=word,
            text=True,
            capture_output=True,
            check=True,
            timeout=25,
            encoding="utf-8",
        )
    except (OSError, subprocess.SubprocessError):
        return False

    return output_path.exists() and output_path.stat().st_size > 0


def _generate_with_espeak(word: str, output_path: Path, variant: str) -> bool:
    executable = _resolve_executable(settings.espeak_path)
    if not executable:
        return False

    cmd = [
        executable,
        "-q",
        "-v",
        _espeak_voice(variant),
        "-w",
        str(output_path),
        word,
    ]

    try:
        subprocess.run(
            cmd,
            capture_output=True,
            check=True,
            timeout=15,
            encoding="utf-8",
        )
    except (OSError, subprocess.SubprocessError):
        return False

    return output_path.exists() and output_path.stat().st_size > 0


def ensure_audio_file(word: str, variant: str = "us") -> Optional[str]:
    normalized = clean_word(word)
    if not normalized:
        return None

    backend = "piper" if (_configured_model_paths(variant)[0] or _voice_setting(variant)) else "espeak"
    file_name = _build_audio_filename(normalized, variant, backend)
    output_path = AUDIO_CACHE_DIR / file_name
    if output_path.exists() and output_path.stat().st_size > 0:
        return f"/generated-audio/{file_name}"

    if _generate_with_piper(normalized, output_path, variant):
        return f"/generated-audio/{file_name}"

    if _generate_with_espeak(normalized, output_path, variant):
        return f"/generated-audio/{file_name}"

    return None


def get_audio_urls(word: str) -> dict:
    return {
        "uk_audio": ensure_audio_file(word, "uk"),
        "us_audio": ensure_audio_file(word, "us"),
    }
