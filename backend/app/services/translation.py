import hashlib
import random
from typing import List

import httpx
from sqlalchemy.orm import Session

from .. import models
from ..config import settings


BAIDU_MAX_TEXT_LENGTH = 6000
BAIDU_MAX_PARAGRAPH_LENGTH = 4000
PARAGRAPH_BREAK_MARKER = "\n\n[[IELTS_PARAGRAPH_BREAK_9F3C2A]]\n\n"


def split_paragraphs(text: str) -> List[str]:
    paragraphs = text.split("\n\n")
    return [paragraph.strip() for paragraph in paragraphs if paragraph.strip()]


def _generate_salt_and_sign(query: str) -> tuple[str, str]:
    salt = str(random.randint(32768, 65536))
    sign_str = f"{settings.baidu_appid}{query}{salt}{settings.baidu_secret_key}"
    sign = hashlib.md5(sign_str.encode("utf-8")).hexdigest()
    return salt, sign


def translate_with_baidu(text: str, target_lang: str = "zh") -> str:
    if not text.strip():
        return ""

    if not settings.baidu_appid or not settings.baidu_secret_key:
        raise ValueError("Baidu translation is not configured")

    salt, sign = _generate_salt_and_sign(text)
    api_url = "https://fanyi-api.baidu.com/api/trans/vip/translate"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    body = {
        "q": text,
        "from": "auto",
        "to": target_lang,
        "appid": settings.baidu_appid,
        "salt": salt,
        "sign": sign,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(api_url, headers=headers, data=body)
    except Exception as ssl_err:
        if "SSL" in str(ssl_err) or "EOF" in str(ssl_err):
            with httpx.Client(timeout=30.0, verify=False) as client:
                response = client.post(api_url, headers=headers, data=body)
        else:
            raise

    if response.status_code != 200:
        raise Exception(f"Baidu translation API error: {response.status_code} - {response.text}")

    data = response.json()
    if "error_code" in data:
        raise Exception(f"Baidu translation API error: {data['error_code']} - {data.get('error_msg', 'Unknown error')}")

    translations = data.get("trans_result", [])
    if not translations:
        raise Exception("Baidu translation API returned an empty result")

    return "".join(item.get("dst", "") for item in translations)


def translate_with_deepl(text: str, target_lang: str = "ZH") -> str:
    if not text.strip():
        return ""

    if not settings.deepl_api_key:
        raise ValueError("DeepL API key not configured")

    headers = {
        "Authorization": f"DeepL-Auth-Key {settings.deepl_api_key}",
        "Content-Type": "application/json",
    }
    body = {"text": [text], "target_lang": target_lang}

    with httpx.Client(timeout=30.0) as client:
        response = client.post(f"{settings.deepl_api_url}/v2/translate", headers=headers, json=body)

    if response.status_code != 200:
        raise Exception(f"DeepL API error: {response.status_code} - {response.text}")

    data = response.json()
    translations = data.get("translations", [])
    if not translations:
        raise Exception("DeepL API returned empty translation")

    return translations[0].get("text", "")


def get_baidu_translation_usage() -> dict:
    return {
        "message": "Please check usage in the Baidu translation console",
        "docs_url": "https://fanyi-api.baidu.com/",
    }


def get_deepl_usage() -> dict:
    if not settings.deepl_api_key:
        raise ValueError("DeepL API key not configured")

    headers = {"Authorization": f"DeepL-Auth-Key {settings.deepl_api_key}"}
    with httpx.Client(timeout=10.0) as client:
        response = client.get(f"{settings.deepl_api_url}/v2/usage", headers=headers)

    if response.status_code != 200:
        raise Exception(f"DeepL API error: {response.status_code} - {response.text}")

    data = response.json()
    return {
        "character_count": data.get("character_count", 0),
        "character_limit": data.get("character_limit", 0),
    }


def _split_long_text(text: str, max_length: int = BAIDU_MAX_PARAGRAPH_LENGTH) -> List[str]:
    sentences = text.replace("? ", "?| ").replace("! ", "!| ").replace(". ", ".| ").split("| ")
    chunks: List[str] = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) > max_length:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence
        else:
            current_chunk += f" {sentence}" if current_chunk else sentence

    if current_chunk:
        chunks.append(current_chunk.strip())

    if not chunks:
        chunks = [text[i : i + max_length] for i in range(0, len(text), max_length)]

    return chunks


def _batch_paragraphs(paragraphs: List[str], max_length: int = BAIDU_MAX_TEXT_LENGTH) -> List[List[str]]:
    batches: List[List[str]] = []
    current_batch: List[str] = []
    current_length = 0

    for paragraph in paragraphs:
        paragraph_length = len(paragraph)
        separator_length = len(PARAGRAPH_BREAK_MARKER) if current_batch else 0

        if current_batch and current_length + separator_length + paragraph_length > max_length:
            batches.append(current_batch)
            current_batch = [paragraph]
            current_length = paragraph_length
            continue

        current_batch.append(paragraph)
        current_length += separator_length + paragraph_length

    if current_batch:
        batches.append(current_batch)

    return batches


def _translate_with_fallback(text: str, target_lang: str = "zh") -> str:
    if settings.baidu_appid and settings.baidu_secret_key:
        try:
            return translate_with_baidu(text, target_lang)
        except Exception as exc:
            print(f"[translation] Baidu failed, falling back to DeepL: {exc}")

    if settings.deepl_api_key:
        return translate_with_deepl(text, "ZH")

    raise ValueError("No translation provider is configured")


def _translate_paragraph_batch(paragraphs: List[str], target_lang: str = "zh") -> List[str]:
    if not paragraphs:
        return []

    if len(paragraphs) == 1:
        return [_translate_with_fallback(paragraphs[0], target_lang)]

    translated = _translate_with_fallback(PARAGRAPH_BREAK_MARKER.join(paragraphs), target_lang)
    translated_parts = translated.split(PARAGRAPH_BREAK_MARKER)
    if len(translated_parts) == len(paragraphs):
        return [part.strip() for part in translated_parts]

    return [_translate_with_fallback(paragraph, target_lang) for paragraph in paragraphs]


def _translate_paragraphs(paragraphs: List[str], target_lang: str = "zh") -> List[str]:
    translated_paragraphs: List[str] = []
    short_paragraphs: List[str] = []

    def flush_short_paragraphs() -> None:
        nonlocal short_paragraphs
        if not short_paragraphs:
            return
        for batch in _batch_paragraphs(short_paragraphs):
            translated_paragraphs.extend(_translate_paragraph_batch(batch, target_lang))
        short_paragraphs = []

    for paragraph in paragraphs:
        if len(paragraph) > BAIDU_MAX_PARAGRAPH_LENGTH:
            flush_short_paragraphs()
            translated_parts = [
                _translate_with_fallback(chunk, target_lang) for chunk in _split_long_text(paragraph)
            ]
            translated_paragraphs.append("\n".join(translated_parts))
        else:
            short_paragraphs.append(paragraph)

    flush_short_paragraphs()
    return translated_paragraphs


def translate_article(db: Session, article: models.Article) -> models.Article:
    if article.translated_text:
        return article

    original_text = article.original_text
    if not original_text:
        return article

    paragraphs = split_paragraphs(original_text)
    article.translated_text = "\n\n".join(_translate_paragraphs(paragraphs, "zh"))
    article.detected_language = "en"
    article.word_count = len(original_text.split())

    db.add(article)
    db.commit()
    db.refresh(article)
    return article


def translate_text(text: str) -> str:
    if not text.strip():
        return ""
    return _translate_with_fallback(text, "zh")


def translate_text_preserving_paragraphs(text: str) -> str:
    if not text.strip():
        return ""

    paragraphs = split_paragraphs(text)
    if not paragraphs:
        return ""

    return "\n\n".join(_translate_paragraphs(paragraphs, "zh"))
