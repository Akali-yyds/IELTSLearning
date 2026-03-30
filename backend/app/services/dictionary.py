import httpx
from dataclasses import dataclass, field
from typing import List, Optional

from .lemmatizer import build_lookup_candidates, clean_word
from . import ecdict as ecdict_svc


@dataclass
class Meaning:
    part_of_speech: str
    definitions: List[str]
    examples: List[str] | None = None


@dataclass
class DictionaryEntry:
    word: str
    lemma: str
    phonetic: Optional[str]
    pronunciation_url: Optional[str]
    meanings: List[Meaning]
    synonyms: List[str]
    source: str
    # 新增字段
    chinese_translation: Optional[str] = None  # 中文释义
    uk_phonetic: Optional[str] = None  # 英音音标
    us_phonetic: Optional[str] = None  # 美音音标
    uk_audio: Optional[str] = None  # 英音音频
    us_audio: Optional[str] = None  # 美音音频
    sentences: List[dict] = field(default_factory=list)  # 双语例句
    phrases: List[dict] = field(default_factory=list)  # 短语


def _query_xxapi(word: str) -> Optional[dict]:
    """
    查询 xxapi 词典接口
    """
    url = f"https://v2.xxapi.cn/api/englishwords?word={word}"

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url)
    except Exception as e:
        raise Exception(f"Dictionary API request failed: {str(e)}")

    if response.status_code == 404:
        return None

    if response.status_code != 200:
        raise Exception(f"Dictionary API error: {response.status_code} - {response.text}")

    try:
        data = response.json()
    except Exception as e:
        raise Exception(f"Dictionary API response parse error: {str(e)}")

    if not data or data.get("code") != 200:
        return None

    return data.get("data")


def _parse_xxapi_entry(entry: dict, matched_word: str) -> DictionaryEntry:
    """
    解析 xxapi 返回的数据
    """
    # 提取单词
    word_text = entry.get("word", matched_word)

    # 提取音标
    uk_phonetic = entry.get("ukphone", "")
    us_phonetic = entry.get("usphone", "")
    phonetic = uk_phonetic or us_phonetic or None

    # 提取发音链接（优先使用英音）
    uk_audio = entry.get("ukspeech") or None
    us_audio = entry.get("usspeech") or None
    pronunciation_url = uk_audio or us_audio

    # 提取中文释义
    translations = entry.get("translations", [])
    chinese_translation = ""
    if translations:
        cn_parts = []
        for t in translations:
            if t.get("tran_cn"):
                cn_parts.append(t.get("tran_cn"))
        chinese_translation = "; ".join(cn_parts[:3])  # 最多3个

    # 提取词性和释义（从 translations 构建）
    meanings: List[Meaning] = []
    if translations:
        for t in translations:
            pos = t.get("pos", "")
            tran_cn = t.get("tran_cn", "")
            if tran_cn:
                meanings.append(Meaning(
                    part_of_speech=pos,
                    definitions=[tran_cn],
                    examples=None,
                ))

    # 提取同义词
    synonyms: List[str] = []
    synonyms_data = entry.get("synonyms", [])
    for syn in synonyms_data:
        hwd_list = syn.get("Hwds", [])
        for hwd in hwd_list:
            if hwd.get("word"):
                synonyms.append(hwd.get("word"))

    # 提取双语例句
    sentences: List[dict] = []
    sentences_data = entry.get("sentences", [])
    for s in sentences_data:
        if s.get("s_content") and s.get("s_cn"):
            sentences.append({
                "english": s.get("s_content"),
                "chinese": s.get("s_cn"),
            })

    # 提取短语
    phrases: List[dict] = []
    phrases_data = entry.get("phrases", [])
    for p in phrases_data:
        if p.get("p_content") and p.get("p_cn"):
            phrases.append({
                "phrase": p.get("p_content"),
                "translation": p.get("p_cn"),
            })

    return DictionaryEntry(
        word=word_text,
        lemma=matched_word,  # 用命中的词根
        phonetic=phonetic,
        pronunciation_url=pronunciation_url,
        meanings=meanings,
        synonyms=synonyms[:10],  # 最多10个
        source="xxapi",
        chinese_translation=chinese_translation or None,
        uk_phonetic=uk_phonetic or None,
        us_phonetic=us_phonetic or None,
        uk_audio=uk_audio,
        us_audio=us_audio,
        sentences=sentences[:5],  # 最多5个例句
        phrases=phrases[:5],  # 最多5个短语
    )


def lookup_word(word: str) -> DictionaryEntry:
    """
    使用 xxapi 查询单词（支持中英双语）
    直接查询，不做词形还原
    """
    import re
    clean = re.sub(r'[^a-zA-Z\-]', '', word).lower().strip()

    if not clean:
        raise ValueError(f"Invalid word: {word}")

    entry_data = _query_xxapi(clean)

    if entry_data is None:
        return DictionaryEntry(
            word=clean,
            lemma=clean,
            phonetic=None,
            pronunciation_url=None,
            meanings=[],
            synonyms=[],
            source="xxapi",
        )

    return _parse_xxapi_entry(entry_data, clean)


def _xxapi_supplement(word: str) -> dict:
    """
    从 xxapi 获取补充信息（音频、例句、短语、同义词）
    word 应为词根形式
    """
    try:
        entry_data = _query_xxapi(word)
        if not entry_data:
            return {}
        e = _parse_xxapi_entry(entry_data, word)
        return {
            "uk_phonetic": e.uk_phonetic,
            "us_phonetic": e.us_phonetic,
            "uk_audio": e.uk_audio,
            "us_audio": e.us_audio,
            "chinese_translation": e.chinese_translation,
            "sentences": e.sentences,
            "phrases": e.phrases,
            "synonyms": e.synonyms,
        }
    except Exception:
        return {}


def _xxapi_supplement_smart(word: str, exchange: dict) -> tuple:
    """
    智能补充：优先用 ECDICT exchange 链条找词根，再用候选列表兜底。
    返回 (base_word, supplement_dict)，base_word 是实际命中 xxapi 的单词。

    查找顺序：
      1. exchange["lemma"]（ECDICT 直接标注的词根，如 stop / encourage）
      2. build_lookup_candidates 的候选列表（NLTK + 后缀规则，短词优先）
      3. 原词本身（最后兜底）
    """
    # 1. 走 exchange 链条
    lemma = exchange.get("lemma")
    if lemma:
        result = _xxapi_supplement(lemma)
        if result.get("uk_audio") or result.get("us_audio") or result.get("sentences"):
            return lemma, result

    # 2. 走候选列表（NLTK + 后缀规则）
    candidates = build_lookup_candidates(word).get("candidates", [])
    for candidate in candidates:
        if candidate == word:
            continue
        result = _xxapi_supplement(candidate)
        if result.get("uk_audio") or result.get("us_audio") or result.get("sentences"):
            return candidate, result

    # 3. 原词兜底
    return word, _xxapi_supplement(word)


def lookup_word_smart(raw_word: str) -> dict:
    """
    智能查词：ECDICT 主词典 + xxapi 补充音频/例句/短语

    ECDICT 路径（推荐）：
      直接用清洗后的词查询，ECDICT 已收录所有变形（ed/ing/ly/比较级等），无需词形还原。

    xxapi 回退路径（仅 ECDICT 不可用时）：
      走 NLTK + 后缀规则的候选列表，逐一尝试 xxapi。
    """
    if not raw_word:
        return {"raw_word": raw_word, "normalized": "", "matched_word": None, "result": None}

    normalized = clean_word(raw_word)
    if not normalized:
        return {"raw_word": raw_word, "normalized": "", "matched_word": None, "result": None}

    # ── ECDICT：直接查，无需词形还原 ──────────────────────
    if ecdict_svc.is_available():
        ecdict_result = ecdict_svc.query_smart(normalized)
        if ecdict_result:
            matched = ecdict_result.get("matched_word", normalized)
            exchange = ecdict_result.get("exchange", {})
            base_word, supplement = _xxapi_supplement_smart(matched, exchange)

            if base_word == matched:
                # 同一个词：音频/例句直接合并
                if supplement.get("uk_audio") or supplement.get("us_audio"):
                    ecdict_result["uk_phonetic"] = supplement.get("uk_phonetic") or ecdict_result.get("uk_phonetic")
                    ecdict_result["us_phonetic"] = supplement.get("us_phonetic") or ecdict_result.get("us_phonetic")
                    ecdict_result["uk_audio"] = supplement.get("uk_audio")
                    ecdict_result["us_audio"] = supplement.get("us_audio")
                if supplement.get("sentences"):
                    ecdict_result["sentences"] = supplement["sentences"]
                if supplement.get("phrases"):
                    ecdict_result["phrases"] = supplement["phrases"]
                if supplement.get("synonyms"):
                    ecdict_result["synonyms"] = supplement["synonyms"]
            else:
                # 不同词（如 encouragingly → encourage）：
                # 不覆盖当前词的音标，将词根数据放入独立的 base_form 字段
                ecdict_result["base_form"] = {
                    "word": base_word,
                    "uk_phonetic": supplement.get("uk_phonetic"),
                    "us_phonetic": supplement.get("us_phonetic"),
                    "uk_audio": supplement.get("uk_audio"),
                    "us_audio": supplement.get("us_audio"),
                    "chinese_translation": supplement.get("chinese_translation"),
                    "sentences": supplement.get("sentences") or [],
                    "phrases": supplement.get("phrases") or [],
                    "synonyms": supplement.get("synonyms") or [],
                }

            return {
                "raw_word": raw_word,
                "normalized": normalized,
                "matched_word": matched,
                "result": ecdict_result,
            }

    # ── xxapi 回退：ECDICT 不可用时才走词形还原 ────────────
    lookup_info = build_lookup_candidates(raw_word)
    candidates = lookup_info.get("candidates", [normalized])
    for candidate in candidates:
        try:
            entry_data = _query_xxapi(candidate)
            if entry_data:
                entry = _parse_xxapi_entry(entry_data, candidate)
                return {
                    "raw_word": raw_word,
                    "normalized": normalized,
                    "matched_word": candidate,
                    "result": _entry_to_dict(entry),
                }
        except Exception:
            continue

    return {"raw_word": raw_word, "normalized": normalized, "matched_word": None, "result": None}


def lookup_word_simple(word: str) -> Optional[dict]:
    """
    简化版查询，返回前端需要的字典结构
    """
    try:
        entry = lookup_word(word)
        return _entry_to_dict(entry)
    except Exception:
        return None


def _entry_to_dict(entry: DictionaryEntry) -> dict:
    """
    将 DictionaryEntry 转为前端需要的字典
    """
    return {
        "word": entry.word,
        "lemma": entry.lemma,
        "phonetic": entry.phonetic,
        "pronunciation_url": entry.pronunciation_url,
        "chinese_translation": entry.chinese_translation,
        "uk_phonetic": entry.uk_phonetic,
        "us_phonetic": entry.us_phonetic,
        "uk_audio": entry.uk_audio,
        "us_audio": entry.us_audio,
        "meanings": [
            {
                "part_of_speech": m.part_of_speech,
                "definitions": m.definitions,
                "examples": m.examples or [],
            }
            for m in entry.meanings
        ],
        "synonyms": entry.synonyms,
        "sentences": entry.sentences,
        "phrases": entry.phrases,
    }
