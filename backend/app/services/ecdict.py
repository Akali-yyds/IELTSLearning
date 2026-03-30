"""
ECDICT 本地 SQLite 词典服务
数据库文件: backend/data/stardict.db
下载/构建: python setup_ecdict.py
"""

import os
import re
import sqlite3
import threading
from typing import Optional, Tuple

_DB_PATH = os.path.join(os.path.dirname(__file__), "../../data/stardict.db")
_DB_PATH = os.path.normpath(_DB_PATH)

_local = threading.local()
_conn_lock = threading.Lock()
_available: Optional[bool] = None


def _get_conn() -> Optional[sqlite3.Connection]:
    """获取当前线程的 SQLite 连接（懒初始化）"""
    global _available
    if _available is False:
        return None
    if not hasattr(_local, "conn") or _local.conn is None:
        if not os.path.exists(_DB_PATH):
            _available = False
            return None
        conn = sqlite3.connect(_DB_PATH)
        conn.row_factory = sqlite3.Row
        _local.conn = conn
        _available = True
    return _local.conn


def is_available() -> bool:
    return _get_conn() is not None


def _parse_tags(tag_str: str) -> dict:
    """
    解析 tag 字段，返回各考试标注
    tag 格式举例: "ielts toefl gre cet4 cet6 ky"
    """
    if not tag_str:
        return {}
    tags = tag_str.lower().split()
    return {
        "ielts": "ielts" in tags,
        "toefl": "toefl" in tags,
        "gre": "gre" in tags,
        "cet4": "cet4" in tags,
        "cet6": "cet6" in tags,
        "ky": "ky" in tags,       # 考研
        "gk": "gk" in tags,       # 高考
        "zk": "zk" in tags,       # 中考
    }


def _parse_exchange(exchange_str: str) -> dict:
    """
    解析 exchange 字段
    格式: "d:done/p:did/3:does/i:doing/0:do"
    类型: p=过去式 d=过去分词 3=第三人称单数 i=现在分词
          r=比较级 t=最高级 s=复数 0=原型(lemma)
    """
    if not exchange_str:
        return {}
    result = {}
    type_map = {
        "p": "past", "d": "past_participle", "3": "third_person",
        "i": "present_participle", "r": "comparative", "t": "superlative",
        "s": "plural", "0": "lemma", "1": "variant",
    }
    for item in exchange_str.split("/"):
        if ":" not in item:
            continue
        t, val = item.split(":", 1)
        key = type_map.get(t, t)
        result[key] = val
    return result


def _parse_translation(translation_str: str) -> Tuple[str, list]:
    """
    解析 translation 字段为中文释义汇总 + meanings 列表
    格式举例:
        adv. 鼓励地；令人鼓舞地
    或多义词:
        n. 鼓励；激励
        v. 鼓励；支持
    """
    if not translation_str:
        return "", []
    lines = [l.strip() for l in translation_str.strip().splitlines() if l.strip()]
    meanings = []
    for line in lines:
        m = re.match(r"^([a-z]+\.)?\s*(.+)$", line)
        if m:
            pos = m.group(1) or ""
            definition = m.group(2)
            meanings.append({
                "part_of_speech": pos.rstrip("."),
                "definitions": [definition],
                "examples": [],
            })
    chinese_summary = "; ".join(
        m["definitions"][0] for m in meanings if m["definitions"]
    )[:120]
    return chinese_summary, meanings


def _parse_definition(definition_str: str) -> str:
    """提取英文释义（可能是多行，取前两行）"""
    if not definition_str:
        return ""
    lines = [l.strip() for l in definition_str.strip().splitlines() if l.strip()]
    return "\n".join(lines[:3])


def _row_to_dict(row: sqlite3.Row, matched_word: str) -> dict:
    """将 stardict 行转为统一格式"""
    word_text = row["word"]
    phonetic = row["phonetic"] or ""
    translation_raw = row["translation"] or ""
    definition_raw = row["definition"] or ""
    chinese_summary, meanings = _parse_translation(translation_raw)
    exchange = _parse_exchange(row["exchange"] or "")
    tags = _parse_tags(row["tag"] or "")
    collins = int(row["collins"]) if row["collins"] else 0
    oxford = bool(row["oxford"]) if row["oxford"] else False
    bnc = row["bnc"]
    frq = row["frq"]

    return {
        "word": word_text,
        "matched_word": matched_word,
        "phonetic": phonetic,
        "uk_phonetic": phonetic,
        "us_phonetic": phonetic,
        "uk_audio": None,
        "us_audio": None,
        "chinese_translation": chinese_summary,
        "english_definition": _parse_definition(definition_raw),
        "meanings": meanings,
        "synonyms": [],
        "sentences": [],
        "phrases": [],
        "exchange": exchange,
        "tags": tags,
        "collins": collins,
        "oxford": oxford,
        "bnc": bnc,
        "frq": frq,
        "source": "ecdict",
    }


def query(word: str) -> Optional[dict]:
    """直接查询单词（精确匹配，大小写不敏感）"""
    conn = _get_conn()
    if conn is None:
        return None
    try:
        cursor = conn.execute(
            "SELECT * FROM stardict WHERE word = ? COLLATE NOCASE",
            (word.lower(),),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return _row_to_dict(row, word.lower())
    except Exception:
        return None


def query_smart(word: str, max_hops: int = 3) -> Optional[dict]:
    """
    智能查词：直查 → 沿 exchange[lemma] 链条向上回溯词根（最多 max_hops 步）
    例: encouragingly → encouraging → encourage
    """
    conn = _get_conn()
    if conn is None:
        return None

    visited = set()
    current = word.lower()

    for _ in range(max_hops + 1):
        if current in visited:
            break
        visited.add(current)

        result = query(current)
        if result is None:
            break

        exchange = result.get("exchange", {})
        lemma = exchange.get("lemma")

        # 当前词有完整释义，直接返回（即使有更短词根，当前词已可用）
        if result.get("chinese_translation") or result.get("meanings"):
            result["raw_word"] = word.lower()
            return result

        # 没有释义但有 lemma，继续向上
        if lemma and lemma != current:
            current = lemma.lower()
        else:
            break

    return None


def query_candidates(candidates: list) -> Optional[dict]:
    """
    按候选列表顺序逐个查询，返回第一个命中的结果
    candidates 已由外部按优先级排好序（短词在前）
    """
    for candidate in candidates:
        result = query_smart(candidate)
        if result:
            return result
    return None
