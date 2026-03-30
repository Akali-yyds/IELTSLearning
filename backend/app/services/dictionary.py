from typing import Optional

from .lemmatizer import clean_word
from . import ecdict as ecdict_svc


def lookup_word_smart(raw_word: str) -> dict:
    """
    智能查词：纯 ECDICT 本地词典，无网络请求。
    ECDICT 已收录所有变形（ed/ing/ly/比较级等），直接按清洗后的词查询，沿 exchange 链回溯词根。
    """
    if not raw_word:
        return {"raw_word": raw_word, "normalized": "", "matched_word": None, "result": None}

    normalized = clean_word(raw_word)
    if not normalized:
        return {"raw_word": raw_word, "normalized": "", "matched_word": None, "result": None}

    if not ecdict_svc.is_available():
        return {"raw_word": raw_word, "normalized": normalized, "matched_word": None, "result": None}

    result = ecdict_svc.query_smart(normalized)
    if not result:
        return {"raw_word": raw_word, "normalized": normalized, "matched_word": None, "result": None}

    matched = result.get("matched_word", normalized)
    return {
        "raw_word": raw_word,
        "normalized": normalized,
        "matched_word": matched,
        "result": result,
    }


def lookup_word(word: str) -> Optional[dict]:
    """
    直接查询单词（精确匹配 + exchange 回溯），返回 ECDICT 结果字典。
    """
    import re
    clean = re.sub(r"[^a-zA-Z\-]", "", word).lower().strip()
    if not clean:
        return None
    return ecdict_svc.query_smart(clean)
