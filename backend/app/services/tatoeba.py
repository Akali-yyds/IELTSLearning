import os
import re
import sqlite3
import threading
from functools import lru_cache
from pathlib import Path

from ..config import settings
from .lemmatizer import clean_word

_local = threading.local()
_conn_lock = threading.Lock()
_available: bool | None = None


def _resolve_db_path() -> Path:
    configured = Path(settings.tatoeba_db_path)
    if configured.is_absolute():
        return configured
    return (Path(__file__).resolve().parents[2] / configured).resolve()


def _get_conn() -> sqlite3.Connection | None:
    global _available
    if _available is False:
        return None

    conn = getattr(_local, "conn", None)
    if conn is not None:
        return conn

    db_path = _resolve_db_path()
    if not db_path.exists():
        _available = False
        return None

    with _conn_lock:
        conn = getattr(_local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(str(db_path), check_same_thread=False)
            conn.row_factory = sqlite3.Row
            _local.conn = conn
            _available = True
    return conn


def is_available() -> bool:
    return _get_conn() is not None


def _build_candidates(word: str, lemma: str = "") -> list[str]:
    candidates: list[str] = []
    for candidate in (clean_word(word), clean_word(lemma)):
        if candidate and candidate not in candidates:
            candidates.append(candidate)
    return candidates


def _contains_whole_word(sentence: str, word: str) -> bool:
    return bool(re.search(rf"\b{re.escape(word)}\b", sentence.lower()))


def _fts_query(candidate: str) -> str:
    escaped = candidate.replace('"', '""')
    return f'"{escaped}"'


def _search_candidate(candidate: str, limit: int) -> list[dict]:
    conn = _get_conn()
    if conn is None:
        return []

    overscan = max(limit * settings.tatoeba_query_scan_limit, 20)
    rows = conn.execute(
        """
        SELECT e.english, e.chinese, e.english_lower
        FROM examples_fts f
        JOIN examples e ON e.id = f.rowid
        WHERE examples_fts MATCH ?
        ORDER BY e.english_len ASC, e.id ASC
        LIMIT ?
        """,
        (_fts_query(candidate), overscan),
    ).fetchall()

    examples: list[dict] = []
    seen_english: set[str] = set()
    for row in rows:
        english = (row["english"] or "").strip()
        chinese = (row["chinese"] or "").strip()
        english_lower = (row["english_lower"] or english.lower()).strip()
        if not english or not chinese:
            continue
        if english_lower in seen_english:
            continue
        if not _contains_whole_word(english, candidate):
            continue
        seen_english.add(english_lower)
        examples.append({
            "english": english,
            "chinese": chinese,
        })
        if len(examples) >= limit:
            break

    return examples


@lru_cache(maxsize=4096)
def get_example_sentences(word: str, lemma: str = "", limit: int | None = None) -> list[dict]:
    final_limit = limit or settings.tatoeba_max_examples
    final_limit = max(1, min(final_limit, 5))

    examples: list[dict] = []
    seen_english: set[str] = set()

    for candidate in _build_candidates(word, lemma):
        for item in _search_candidate(candidate, final_limit):
            english_lower = item["english"].lower()
            if english_lower in seen_english:
                continue
            seen_english.add(english_lower)
            examples.append(item)
            if len(examples) >= final_limit:
                return examples

    return examples


def clear_cache() -> None:
    global _available
    get_example_sentences.cache_clear()
    _available = None
    conn = getattr(_local, "conn", None)
    if conn is not None:
        conn.close()
        _local.conn = None
