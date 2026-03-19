import httpx
from dataclasses import dataclass
from typing import List, Optional


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
    sentences: List[dict] = None  # 双语例句
    phrases: List[dict] = None  # 短语

    def __post_init__(self):
        if self.sentences is None:
            self.sentences = []
        if self.phrases is None:
            self.phrases = []


def lookup_word(word: str) -> DictionaryEntry:
    """
    使用 xxapi 查询单词（支持中英双语）
    """
    import re
    clean_word = re.sub(r'[^a-zA-Z\-]', '', word).lower().strip()

    if not clean_word:
        raise ValueError(f"Invalid word: {word}")

    url = f"https://v2.xxapi.cn/api/englishwords?word={clean_word}"

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url)
    except Exception as e:
        raise Exception(f"Dictionary API request failed: {str(e)}")

    if response.status_code == 404:
        return DictionaryEntry(
            word=clean_word,
            lemma=clean_word,
            phonetic=None,
            pronunciation_url=None,
            meanings=[],
            synonyms=[],
            source="xxapi",
        )

    if response.status_code != 200:
        raise Exception(f"Dictionary API error: {response.status_code} - {response.text}")

    try:
        data = response.json()
    except Exception as e:
        raise Exception(f"Dictionary API response parse error: {str(e)}")

    if not data or data.get("code") != 200:
        raise Exception(f"Dictionary API returned invalid data: {data}")

    entry = data.get("data", {})

    # 提取单词
    word_text = entry.get("word", clean_word)

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
        lemma=word_text,
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


def lookup_word_simple(word: str) -> Optional[dict]:
    """
    简化版查询，返回前端需要的字典结构
    """
    try:
        entry = lookup_word(word)
        return {
            "word": entry.word,
            "phonetic": entry.phonetic,
            "pronunciation_url": entry.pronunciation_url,
            # 新增字段
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
    except Exception as e:
        return None
