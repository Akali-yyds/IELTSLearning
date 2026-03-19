import os
from typing import List, Optional

import httpx
from sqlalchemy.orm import Session

from .. import models
from ..config import settings


# DeepL API 相关常量
DEEPL_MAX_TEXT_LENGTH = 128 * 1024  # 128 KiB 限制
DEEPL_MAX_PARAGRAPH_LENGTH = 50_000  # 单段最大字符数


def split_paragraphs(text: str) -> List[str]:
    """
    按段落切分文本
    保留空行作为段落分隔符标记
    """
    paragraphs = text.split("\n\n")
    return [p.strip() for p in paragraphs if p.strip()]


def translate_with_deepl(text: str, target_lang: str = "ZH") -> str:
    """
    调用 DeepL API 翻译文本
    """
    if not text.strip():
        return ""

    api_key = settings.deepl_api_key
    if not api_key:
        raise ValueError("DeepL API key not configured")

    api_url = f"{settings.deepl_api_url}/v2/translate"

    headers = {
        "Authorization": f"DeepL-Auth-Key {api_key}",
        "Content-Type": "application/json",
    }

    body = {
        "text": [text],
        "target_lang": target_lang,
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(api_url, headers=headers, json=body)

    if response.status_code != 200:
        error_detail = response.text
        raise Exception(f"DeepL API error: {response.status_code} - {error_detail}")

    data = response.json()
    translations = data.get("translations", [])
    if not translations:
        raise Exception("DeepL API returned empty translation")

    return translations[0].get("text", "")


def get_deepl_usage() -> dict:
    """
    查询 DeepL API 使用配额
    """
    api_key = settings.deepl_api_key
    if not api_key:
        raise ValueError("DeepL API key not configured")

    api_url = f"{settings.deepl_api_url}/v2/usage"

    headers = {
        "Authorization": f"DeepL-Auth-Key {api_key}",
    }

    with httpx.Client(timeout=10.0) as client:
        response = client.get(api_url, headers=headers)

    if response.status_code != 200:
        error_detail = response.text
        raise Exception(f"DeepL API error: {response.status_code} - {error_detail}")

    data = response.json()
    return {
        "character_count": data.get("character_count", 0),
        "character_limit": data.get("character_limit", 0),
    }


def translate_article(db: Session, article: models.Article) -> models.Article:
    """
    翻译整篇文章（按段落切分）
    """
    if article.translated_text:
        return article

    original_text = article.original_text
    if not original_text:
        return article

    # 按段落切分并翻译
    paragraphs = split_paragraphs(original_text)
    translated_paragraphs: List[str] = []

    for para in paragraphs:
        # 处理可能超过限制的长段落
        if len(para) > DEEPL_MAX_PARAGRAPH_LENGTH:
            # 进一步切分长段落
            sub_paragraphs = _split_long_text(para)
            sub_translated = []
            for sub in sub_paragraphs:
                translated = translate_with_deepl(sub, "ZH")
                sub_translated.append(translated)
            translated_paragraphs.append("\n".join(sub_translated))
        else:
            translated = translate_with_deepl(para, "ZH")
            translated_paragraphs.append(translated)

    # 合并翻译结果
    article.translated_text = "\n\n".join(translated_paragraphs)
    article.detected_language = "en"
    article.word_count = len(original_text.split())

    db.add(article)
    db.commit()
    db.refresh(article)
    return article


def _split_long_text(text: str, max_length: int = 40000) -> List[str]:
    """
    将长文本切分为小块（按句子或固定长度）
    """
    # 先按句子切分
    sentences = text.replace("? ", "?| ").replace("! ", "!| ").replace(". ", ".| ").split("| ")
    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) > max_length:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence
        else:
            current_chunk += " " + sentence if current_chunk else sentence

    if current_chunk:
        chunks.append(current_chunk.strip())

    # 如果切分后仍有问题，直接按长度切分
    if not chunks:
        chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]

    return chunks


def translate_text(text: str) -> str:
    """
    快速翻译文本（不保存到数据库）
    """
    if not text.strip():
        return ""

    return translate_with_deepl(text, "ZH")