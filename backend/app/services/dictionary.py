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


def lookup_word(word: str) -> DictionaryEntry:
    """
    占位实现：
    - 不依赖外部词典 API，返回一个结构化的假数据
    - 方便前端和生词本功能先行开发
    """
    normalized = word.lower()
    return DictionaryEntry(
        word=normalized,
        lemma=normalized,
        phonetic="/demo/",
        pronunciation_url=None,
        meanings=[
            Meaning(
                part_of_speech="n.",
                definitions=[f"Demo meaning for '{normalized}'"],
                examples=[f"This is a demo sentence using {normalized}."],
            )
        ],
        synonyms=[],
        source="local-demo",
    )

