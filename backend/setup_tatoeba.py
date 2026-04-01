"""
Build a local Tatoeba example database for fast English -> Chinese example lookup.

The importer uses Tatoeba's weekly per-language exports:
  - eng_sentences.tsv.bz2
  - cmn_sentences.tsv.bz2
  - eng-cmn_links.tsv.bz2

Chinese translations are normalized to simplified Chinese during import.

Usage:
    python setup_tatoeba.py

Optional:
    python setup_tatoeba.py --output data/tatoeba_examples.db
    python setup_tatoeba.py --eng-sentences path/to/eng_sentences.tsv.bz2
"""

from __future__ import annotations

import argparse
import bz2
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

import httpx

try:
    from opencc import OpenCC
except ImportError:  # pragma: no cover
    OpenCC = None

from app.config import settings

OPENCC = OpenCC("tw2sp") if OpenCC else None

SCHEMA_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE eng_sentences (
    sentence_id INTEGER PRIMARY KEY,
    text TEXT NOT NULL
);

CREATE TABLE cmn_sentences (
    sentence_id INTEGER PRIMARY KEY,
    text TEXT NOT NULL
);

CREATE TABLE eng_cmn_links (
    english_id INTEGER NOT NULL,
    chinese_id INTEGER NOT NULL,
    PRIMARY KEY (english_id, chinese_id)
);

CREATE TABLE examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    english_id INTEGER NOT NULL,
    chinese_id INTEGER NOT NULL,
    english TEXT NOT NULL,
    english_lower TEXT NOT NULL,
    chinese TEXT NOT NULL,
    english_len INTEGER NOT NULL,
    UNIQUE (english_id, chinese_id)
);

CREATE INDEX idx_examples_english_lower ON examples (english_lower);
CREATE INDEX idx_examples_english_len ON examples (english_len);

CREATE VIRTUAL TABLE examples_fts USING fts5(
    english,
    content='examples',
    content_rowid='id',
    tokenize='unicode61'
);

CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download and import Tatoeba sentence pairs into SQLite.")
    parser.add_argument("--output", default=settings.tatoeba_db_path, help="Output SQLite path.")
    parser.add_argument("--eng-sentences", default=settings.tatoeba_sentences_en_url, help="English sentences .tsv.bz2 path or URL.")
    parser.add_argument("--cmn-sentences", default=settings.tatoeba_sentences_cmn_url, help="Chinese sentences .tsv.bz2 path or URL.")
    parser.add_argument("--eng-cmn-links", default=settings.tatoeba_links_eng_cmn_url, help="English-Chinese links .tsv.bz2 path or URL.")
    return parser.parse_args()


def resolve_output_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (Path(__file__).resolve().parent / path).resolve()


def ensure_local_file(source: str, temp_dir: Path) -> Path:
    path = Path(source)
    if path.exists():
        return path.resolve()

    target = temp_dir / Path(source).name
    print(f"Downloading {source}")
    with httpx.stream("GET", source, timeout=120.0, follow_redirects=True) as response:
        response.raise_for_status()
        total = int(response.headers.get("Content-Length", 0) or 0)
        downloaded = 0
        with target.open("wb") as file:
            for chunk in response.iter_bytes():
                file.write(chunk)
                downloaded += len(chunk)
                if total:
                    percent = downloaded / total * 100
                    print(f"\r  {downloaded // 1024}KB / {total // 1024}KB ({percent:.1f}%)", end="", flush=True)
    if total:
        print()
    print(f"Saved to {target}")
    return target


def create_database(db_path: Path) -> sqlite3.Connection:
    os.makedirs(db_path.parent, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA_SQL)
    return conn


def maybe_simplify(text: str) -> str:
    normalized = text.strip()
    if OPENCC is None:
        return normalized
    return OPENCC.convert(normalized)


def load_sentences(conn: sqlite3.Connection, archive_path: Path, table_name: str, simplify: bool = False) -> int:
    print(f"Importing {archive_path.name} -> {table_name}")
    insert_sql = f"INSERT OR REPLACE INTO {table_name} (sentence_id, text) VALUES (?, ?)"
    batch: list[tuple[int, str]] = []
    total = 0

    with bz2.open(archive_path, "rt", encoding="utf-8", errors="replace") as file:
        for line in file:
            line = line.rstrip("\n")
            if not line:
                continue
            parts = line.split("\t", 2)
            if len(parts) < 3:
                continue
            sentence_id_raw, _lang, text = parts
            try:
                sentence_id = int(sentence_id_raw)
            except ValueError:
                continue
            text = maybe_simplify(text) if simplify else text.strip()
            if not text:
                continue
            batch.append((sentence_id, text))
            total += 1
            if len(batch) >= 5000:
                conn.executemany(insert_sql, batch)
                conn.commit()
                batch.clear()
                print(f"\r  imported {total:,} rows", end="", flush=True)

    if batch:
        conn.executemany(insert_sql, batch)
        conn.commit()

    print(f"\r  imported {total:,} rows")
    return total


def load_links(conn: sqlite3.Connection, archive_path: Path) -> int:
    print(f"Importing {archive_path.name} -> eng_cmn_links")
    insert_sql = "INSERT OR IGNORE INTO eng_cmn_links (english_id, chinese_id) VALUES (?, ?)"
    batch: list[tuple[int, int]] = []
    total = 0

    with bz2.open(archive_path, "rt", encoding="utf-8", errors="replace") as file:
        for line in file:
            line = line.rstrip("\n")
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            try:
                english_id = int(parts[0])
                chinese_id = int(parts[1])
            except ValueError:
                continue
            batch.append((english_id, chinese_id))
            total += 1
            if len(batch) >= 5000:
                conn.executemany(insert_sql, batch)
                conn.commit()
                batch.clear()
                print(f"\r  imported {total:,} rows", end="", flush=True)

    if batch:
        conn.executemany(insert_sql, batch)
        conn.commit()

    print(f"\r  imported {total:,} rows")
    return total


def build_examples(conn: sqlite3.Connection) -> int:
    print("Building examples table")
    conn.execute("DELETE FROM examples")
    conn.execute(
        """
        INSERT OR IGNORE INTO examples (
            english_id,
            chinese_id,
            english,
            english_lower,
            chinese,
            english_len
        )
        SELECT
            l.english_id,
            l.chinese_id,
            e.text,
            lower(e.text),
            c.text,
            length(e.text)
        FROM eng_cmn_links l
        JOIN eng_sentences e ON e.sentence_id = l.english_id
        JOIN cmn_sentences c ON c.sentence_id = l.chinese_id
        WHERE trim(e.text) <> '' AND trim(c.text) <> ''
        """
    )
    conn.commit()

    count = conn.execute("SELECT COUNT(*) FROM examples").fetchone()[0]
    print(f"  built {count:,} examples")
    return int(count)


def build_fts(conn: sqlite3.Connection) -> None:
    print("Building FTS index")
    conn.execute("INSERT INTO examples_fts(examples_fts) VALUES ('rebuild')")
    conn.commit()


def write_meta(conn: sqlite3.Connection, stats: dict[str, int | str]) -> None:
    rows = [(key, str(value)) for key, value in stats.items()]
    conn.executemany("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", rows)
    conn.commit()


def drop_staging_tables(conn: sqlite3.Connection) -> None:
    print("Dropping staging tables")
    conn.executescript(
        """
        DROP TABLE IF EXISTS eng_sentences;
        DROP TABLE IF EXISTS cmn_sentences;
        DROP TABLE IF EXISTS eng_cmn_links;
        VACUUM;
        """
    )


def main() -> int:
    args = parse_args()
    output_path = resolve_output_path(args.output)

    with tempfile.TemporaryDirectory(prefix="tatoeba-import-") as temp_dir_raw:
        temp_dir = Path(temp_dir_raw)
        eng_sentences = ensure_local_file(args.eng_sentences, temp_dir)
        cmn_sentences = ensure_local_file(args.cmn_sentences, temp_dir)
        eng_cmn_links = ensure_local_file(args.eng_cmn_links, temp_dir)

        conn = create_database(output_path)
        try:
            eng_count = load_sentences(conn, eng_sentences, "eng_sentences", simplify=False)
            cmn_count = load_sentences(conn, cmn_sentences, "cmn_sentences", simplify=True)
            link_count = load_links(conn, eng_cmn_links)
            example_count = build_examples(conn)
            build_fts(conn)
            write_meta(
                conn,
                {
                    "eng_sentence_count": eng_count,
                    "cmn_sentence_count": cmn_count,
                    "link_count": link_count,
                    "example_count": example_count,
                },
            )
            drop_staging_tables(conn)
        finally:
            conn.close()

    print(f"Tatoeba database ready: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
