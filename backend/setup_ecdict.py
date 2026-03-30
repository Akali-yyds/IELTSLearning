"""
ECDICT 数据库初始化脚本
下载 ecdict.csv 并导入 SQLite（stardict.db）

用法:
    python setup_ecdict.py

完成后生成: backend/data/stardict.db
"""

import csv
import io
import os
import sqlite3
import sys
import urllib.request

CSV_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "stardict.db")

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS "stardict" (
    "id"          INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    "word"        VARCHAR(64) COLLATE NOCASE NOT NULL UNIQUE,
    "sw"          VARCHAR(64) COLLATE NOCASE NOT NULL,
    "phonetic"    VARCHAR(64),
    "definition"  TEXT,
    "translation" TEXT,
    "pos"         VARCHAR(16),
    "collins"     INTEGER DEFAULT(0),
    "oxford"      INTEGER DEFAULT(0),
    "tag"         VARCHAR(64),
    "bnc"         INTEGER DEFAULT(NULL),
    "frq"         INTEGER DEFAULT(NULL),
    "exchange"    TEXT,
    "detail"      TEXT,
    "audio"       TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_word" ON stardict (word);
CREATE INDEX IF NOT EXISTS "idx_sw"   ON stardict (sw);
"""


def stripword(word: str) -> str:
    return "".join(c for c in word if c.isalnum()).lower()


def download_csv(url: str) -> io.StringIO:
    print(f"正在下载 {url} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        total = int(resp.headers.get("Content-Length", 0))
        data = bytearray()
        chunk = 65536
        downloaded = 0
        while True:
            buf = resp.read(chunk)
            if not buf:
                break
            data.extend(buf)
            downloaded += len(buf)
            if total:
                pct = downloaded / total * 100
                print(f"\r  {downloaded // 1024}KB / {total // 1024}KB ({pct:.1f}%)", end="", flush=True)
    print("\n下载完成，共", len(data) // 1024, "KB")
    return io.StringIO(data.decode("utf-8"))


def import_csv(csv_io: io.StringIO, db_path: str):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    if os.path.exists(db_path):
        os.remove(db_path)
        print("已删除旧数据库")

    conn = sqlite3.connect(db_path)
    conn.executescript(CREATE_SQL)

    reader = csv.DictReader(csv_io)
    batch = []
    total = 0
    INSERT_SQL = """
    INSERT OR IGNORE INTO stardict
        (word, sw, phonetic, definition, translation, pos,
         collins, oxford, tag, bnc, frq, exchange, detail, audio)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """

    def flush(batch):
        conn.executemany(INSERT_SQL, batch)
        conn.commit()

    for row in reader:
        word = (row.get("word") or "").strip()
        if not word:
            continue
        sw = stripword(word)
        batch.append((
            word, sw,
            row.get("phonetic") or None,
            row.get("definition") or None,
            row.get("translation") or None,
            row.get("pos") or None,
            int(row["collins"]) if row.get("collins", "").strip().lstrip("-").isdigit() else 0,
            int(row["oxford"])  if row.get("oxford",  "").strip().isdigit() else 0,
            row.get("tag") or None,
            int(row["bnc"]) if row.get("bnc", "").strip().isdigit() else None,
            int(row["frq"]) if row.get("frq", "").strip().isdigit() else None,
            row.get("exchange") or None,
            row.get("detail") or None,
            row.get("audio") or None,
        ))
        total += 1
        if len(batch) >= 2000:
            flush(batch)
            batch.clear()
            print(f"\r  已导入 {total:,} 条...", end="", flush=True)

    if batch:
        flush(batch)
    conn.close()
    print(f"\n导入完成，共 {total:,} 条词条")
    print(f"数据库路径: {db_path}")


def main():
    if os.path.exists(DB_PATH):
        print(f"数据库已存在: {DB_PATH}")
        ans = input("是否重新下载并覆盖？(y/N) ").strip().lower()
        if ans != "y":
            print("已跳过")
            return

    try:
        csv_io = download_csv(CSV_URL)
    except Exception as e:
        print(f"下载失败: {e}")
        print("请手动下载 ecdict.csv 并放到 backend/data/ 目录，然后再次运行此脚本")
        sys.exit(1)

    import_csv(csv_io, DB_PATH)
    print("\nECDICT 初始化完成！")


if __name__ == "__main__":
    main()
