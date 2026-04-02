import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

from ..config import settings
from .tts import get_audio_cache_dir

BACKEND_DIR = Path(__file__).resolve().parents[2]
MAINTENANCE_STATE_FILE = (BACKEND_DIR / settings.audio_cache_maintenance_path).resolve()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _load_state() -> dict:
    if not MAINTENANCE_STATE_FILE.exists():
        return {}
    try:
        return json.loads(MAINTENANCE_STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return {}


def _save_state(state: dict) -> None:
    MAINTENANCE_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    MAINTENANCE_STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _iter_audio_files():
    cache_dir = get_audio_cache_dir()
    if not cache_dir.exists():
        return []
    return [path for path in cache_dir.glob("*.wav") if path.is_file()]


def _is_stale(path: Path, max_age_days: int) -> bool:
    cutoff = _utc_now() - timedelta(days=max_age_days)
    modified_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    return modified_at < cutoff


def get_audio_cache_summary(max_age_days: Optional[int] = None) -> dict:
    resolved_days = max_age_days or settings.audio_cache_cleanup_days
    files = _iter_audio_files()
    stale_files = [path for path in files if _is_stale(path, resolved_days)]
    state = _load_state()

    return {
        "cache_path": str(get_audio_cache_dir()),
        "total_files": len(files),
        "total_bytes": sum(path.stat().st_size for path in files),
        "stale_files": len(stale_files),
        "stale_bytes": sum(path.stat().st_size for path in stale_files),
        "max_age_days": resolved_days,
        "last_auto_cleanup_at": _parse_dt(state.get("last_auto_cleanup_at")),
    }


def cleanup_audio_cache(
    scope: Literal["all", "expired"] = "all",
    max_age_days: Optional[int] = None,
    *,
    mark_auto_cleanup: bool = False,
) -> dict:
    resolved_days = max_age_days or settings.audio_cache_cleanup_days
    files = _iter_audio_files()
    targets = (
        [path for path in files if _is_stale(path, resolved_days)]
        if scope == "expired"
        else files
    )

    deleted_files = 0
    deleted_bytes = 0
    for path in targets:
        try:
            size = path.stat().st_size
            path.unlink(missing_ok=True)
            deleted_files += 1
            deleted_bytes += size
        except OSError:
            continue

    cleaned_at = _utc_now()
    remaining_summary = get_audio_cache_summary(resolved_days)

    if mark_auto_cleanup:
        state = _load_state()
        state["last_auto_cleanup_at"] = cleaned_at.isoformat()
        _save_state(state)

    return {
        "scope": scope,
        "max_age_days": resolved_days,
        "deleted_files": deleted_files,
        "deleted_bytes": deleted_bytes,
        "remaining_files": remaining_summary["total_files"],
        "remaining_bytes": remaining_summary["total_bytes"],
        "cleaned_at": cleaned_at,
    }


def run_scheduled_audio_cache_cleanup() -> Optional[dict]:
    interval_days = settings.audio_cache_cleanup_days
    state = _load_state()
    last_auto_cleanup = _parse_dt(state.get("last_auto_cleanup_at"))
    now = _utc_now()

    if last_auto_cleanup and last_auto_cleanup > now - timedelta(days=interval_days):
        return None

    return cleanup_audio_cache(
        scope="expired",
        max_age_days=interval_days,
        mark_auto_cleanup=True,
    )
