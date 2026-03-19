"""
词形还原服务
将单词的屈折形式还原为词根/原型（lemma）
"""

import re
from functools import lru_cache
from typing import List

import nltk
from nltk.stem import WordNetLemmatizer

# 确保 NLTK 数据可用
try:
    nltk.data.find("corpora/wordnet")
except LookupError:
    nltk.download("wordnet", quiet=True)
    nltk.download("omw-1.4", quiet=True)


# 不规则动词/名词映射表
IRREGULAR_MAP = {
    # 不规则动词
    "went": "go",
    "gone": "go",
    "bought": "buy",
    "brought": "bring",
    "made": "make",
    "done": "do",
    "did": "do",
    "had": "have",
    "has": "have",
    "was": "be",
    "were": "be",
    "been": "be",
    "saw": "see",
    "seen": "see",
    "took": "take",
    "taken": "take",
    "knew": "know",
    "known": "know",
    "thought": "think",
    "thought": "think",
    "came": "come",
    "come": "come",
    "said": "say",
    "said": "say",
    "got": "get",
    "gotten": "get",
    "gave": "give",
    "given": "give",
    "told": "tell",
    "told": "tell",
    "found": "find",
    "found": "find",
    "knew": "know",
    "cancelled": "cancel",
    "canceled": "cancel",
    # 不规则名词
    "children": "child",
    "men": "man",
    "women": "woman",
    "feet": "foot",
    "teeth": "tooth",
    "mice": "mouse",
    "geese": "goose",
    "lice": "louse",
    "oxen": "ox",
    "better": "good",
    "best": "good",
    "worse": "bad",
    "worst": "bad",
    "more": "much",
    "most": "much",
    "less": "little",
    "least": "little",
    # 常见被 lemmatizer 误还原的词
    "bought": "buy",
    "caught": "catch",
    "taught": "teach",
    " fought": "fight",
    "led": "lead",
    "fed": "feed",
    "read": "read",  # 动词原形和过去式相同
    "hit": "hit",
    "cut": "cut",
    "put": "put",
    "set": "set",
    "let": "let",
    "run": "run",
    "ran": "run",
}


def clean_word(raw: str) -> str:
    """
    清洗单词：去除标点、连字符外的特殊字符，转小写
    """
    if not raw:
        return ""
    # 去除首尾非字母字符，但保留撇号和连字符
    cleaned = re.sub(r"^[^\u0041-\u007A\u00C0-\u00FF]+", "", raw)  # 去除开头
    cleaned = re.sub(r"[^\u0041-\u007A\u00C0-\u00FF\-']+$", "", cleaned)  # 去除结尾
    return cleaned.lower().strip("'-").strip()


@lru_cache(maxsize=10000)
def lemmatize(word: str, pos: str = "v") -> str:
    """
    使用 NLTK WordNetLemmatizer 还原词形
    pos: v=动词, n=名词, a=形容词, r=副词
    """
    if not word:
        return word

    wnl = WordNetLemmatizer()

    # 优先查不规则表
    if word in IRREGULAR_MAP:
        return IRREGULAR_MAP[word]

    # 尝试动词还原
    lemma_v = wnl.lemmatize(word, pos="v")
    if lemma_v != word:
        return lemma_v

    # 尝试名词还原
    lemma_n = wnl.lemmatize(word, pos="n")
    if lemma_n != word:
        return lemma_n

    # 尝试形容词还原
    lemma_a = wnl.lemmatize(word, pos="a")
    if lemma_a != word:
        return lemma_a

    return word


def suffix_fallback(word: str) -> List[str]:
    """
    后缀规则兜底：生成可能的词根候选
    """
    candidates = []

    # -ies -> -y (studies -> study)
    if word.endswith("ies") and len(word) > 4 and not word.endswith("eies"):
        candidates.append(word[:-3] + "y")

    # -ied -> -y (tried -> try, studied -> study)
    if word.endswith("ied") and len(word) > 4:
        candidates.append(word[:-3] + "y")
        if len(word) > 5 and word[-4] not in "aeiou":
            candidates.append(word[:-3])  # planned -> plan

    # 双辅音结尾 + -ed -> 去双辅音 + -ed (stopped -> stop)
    double_consonant = re.match(r"([bcdfghjklmnpqrstvwxyz])\\1(ed|ing)$", word)
    if double_consonant:
        base = word[:-3] if word.endswith("ed") else word[:-4]
        candidates.append(base)
        if not base.endswith("e"):
            candidates.append(base + "e")

    # -ed -> 去 -ed (played -> play)
    if word.endswith("ed") and len(word) > 3 and not word.endswith("ied"):
        candidates.append(word[:-2])

    # -ing -> 去 -ing (making -> make, writing -> write)
    if word.endswith("ing") and len(word) > 5:
        base = word[:-3]
        candidates.append(base)
        if not base.endswith("e"):
            candidates.append(base + "e")

    # -es -> 去 -es (watches -> watch, goes -> go)
    es_endings = ("ches", "shes", "xes", "zes", "ses", "oes")
    if any(word.endswith(e) for e in es_endings) and len(word) > 4:
        candidates.append(word[:-2])

    # -s -> 去 -s (plays -> play, cancels -> cancel)
    if word.endswith("s") and not word.endswith("ss") and len(word) > 3:
        candidates.append(word[:-1])

    return candidates


def build_lookup_candidates(raw_word: str) -> dict:
    """
    构建查词候选列表
    返回: { raw, normalized, candidates }
    """
    if not raw_word:
        return {"raw": raw_word, "normalized": "", "candidates": []}

    normalized = clean_word(raw_word)
    if not normalized:
        return {"raw": raw_word, "normalized": "", "candidates": []}

    candidates_set = set()
    candidates_set.add(normalized)

    # 1. 不规则表
    if normalized in IRREGULAR_MAP:
        candidates_set.add(IRREGULAR_MAP[normalized])

    # 2. NLTK lemmatizer 还原
    # 动词优先
    lemma_v = lemmatize(normalized, "v")
    if lemma_v != normalized:
        candidates_set.add(lemma_v)

    # 名词
    lemma_n = lemmatize(normalized, "n")
    if lemma_n != normalized:
        candidates_set.add(lemma_n)

    # 形容词
    lemma_a = lemmatize(normalized, "a")
    if lemma_a != normalized:
        candidates_set.add(lemma_a)

    # 3. 后缀规则兜底
    for fallback in suffix_fallback(normalized):
        if fallback and fallback != normalized:
            candidates_set.add(fallback)
            # 对兜底结果也做 lemmatizer 还原
            lemma_fb = lemmatize(fallback, "v")
            if lemma_fb != fallback:
                candidates_set.add(lemma_fb)

    # 过滤：只保留合法单词
    candidates = [
        w
        for w in candidates_set
        if w and len(w) >= 2 and re.match(r"^[a-z][a-z'-]*$", w)
    ]

    # 按长度排序（短的优先，因为更可能是词根）
    candidates.sort(key=lambda w: (len(w), w))

    # 确保原词在最后
    if normalized not in candidates:
        candidates.append(normalized)

    return {
        "raw": raw_word,
        "normalized": normalized,
        "candidates": candidates,
    }
