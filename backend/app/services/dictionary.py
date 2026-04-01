from typing import Optional

from .lemmatizer import clean_word
from . import ecdict as ecdict_svc
from .pronunciation import get_pronunciation_data
from .tatoeba import get_example_sentences


def enrich_entry(
    entry: dict,
    word: str,
    lemma: str,
    *,
    include_pronunciation: bool = False,
    include_examples: bool = False,
    include_audio: bool = False,
) -> dict:
    if include_pronunciation:
        pronunciation = get_pronunciation_data(word=word, lemma=lemma, include_audio=include_audio)
        if pronunciation.get("phonetic"):
            entry["phonetic"] = pronunciation["phonetic"]
        if pronunciation.get("uk_phonetic"):
            entry["uk_phonetic"] = pronunciation["uk_phonetic"]
        if pronunciation.get("us_phonetic"):
            entry["us_phonetic"] = pronunciation["us_phonetic"]
        if pronunciation.get("uk_audio"):
            entry["uk_audio"] = pronunciation["uk_audio"]
        if pronunciation.get("us_audio"):
            entry["us_audio"] = pronunciation["us_audio"]

    if include_examples and not entry.get("sentences"):
        entry["sentences"] = get_example_sentences(word=word, lemma=lemma)

    return entry


def lookup_word_smart(
    raw_word: str,
    *,
    include_pronunciation: bool = False,
    include_examples: bool = False,
    include_audio: bool = False,
) -> dict:
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
    result = enrich_entry(
        result,
        word=normalized,
        lemma=matched,
        include_pronunciation=include_pronunciation,
        include_examples=include_examples,
        include_audio=include_audio,
    )
    return {
        "raw_word": raw_word,
        "normalized": normalized,
        "matched_word": matched,
        "result": result,
    }


def lookup_word(
    word: str,
    *,
    include_pronunciation: bool = False,
    include_examples: bool = False,
    include_audio: bool = False,
) -> Optional[dict]:
    """
    直接查询单词（精确匹配 + exchange 回溯），返回 ECDICT 结果字典。
    """
    import re
    clean = re.sub(r"[^a-zA-Z\-]", "", word).lower().strip()
    if not clean:
        return None
    result = ecdict_svc.query_smart(clean)
    if not result:
        return None
    return enrich_entry(
        result,
        word=clean,
        lemma=result.get("matched_word", clean),
        include_pronunciation=include_pronunciation,
        include_examples=include_examples,
        include_audio=include_audio,
    )
