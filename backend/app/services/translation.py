import hashlib
import random
from typing import List

import httpx
from sqlalchemy.orm import Session

from .. import models
from ..config import settings


# 百度翻译 API 相关常量
BAIDU_MAX_TEXT_LENGTH = 6000  # 建议单次请求不超过 6000 字节
BAIDU_MAX_PARAGRAPH_LENGTH = 4000  # 单段最大字符数（留余量）


def split_paragraphs(text: str) -> List[str]:
    """
    按段落切分文本
    保留空行作为段落分隔符标记
    """
    paragraphs = text.split("\n\n")
    return [p.strip() for p in paragraphs if p.strip()]


def _generate_salt_and_sign(query: str) -> tuple[str, str]:
    """
    生成百度翻译 API 签名
    签名算法：MD5(appid + query + salt + secret_key)
    """
    salt = str(random.randint(32768, 65536))
    sign_str = f"{settings.baidu_appid}{query}{salt}{settings.baidu_secret_key}"
    sign = hashlib.md5(sign_str.encode("utf-8")).hexdigest()
    return salt, sign


def translate_with_baidu(text: str, target_lang: str = "zh") -> str:
    """
    调用百度翻译开放平台 API 翻译文本
    target_lang: zh=中文, en=英文, ja=日语, ko=韩语 等
    """
    if not text.strip():
        return ""

    if not settings.baidu_appid or not settings.baidu_secret_key:
        raise ValueError("百度翻译 API 未配置 (BAIDU_APPID / BAIDU_SECRET_KEY)")

    api_url = "https://fanyi-api.baidu.com/api/trans/vip/translate"

    salt, sign = _generate_salt_and_sign(text)

    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
    }

    body = {
        "q": text,
        "from": "auto",
        "to": target_lang,
        "appid": settings.baidu_appid,
        "salt": salt,
        "sign": sign,
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(api_url, headers=headers, data=body)

    if response.status_code != 200:
        error_detail = response.text
        raise Exception(f"百度翻译 API 错误: {response.status_code} - {error_detail}")

    data = response.json()

    # 检查错误码
    if "error_code" in data:
        error_msg = data.get("error_msg", "未知错误")
        raise Exception(f"百度翻译 API 错误: {data['error_code']} - {error_msg}")

    translations = data.get("trans_result", [])
    if not translations:
        raise Exception("百度翻译 API 返回空结果")

    # 合并翻译结果（原文可能是分段返回的）
    return "".join(t.get("dst", "") for t in translations)


def translate_with_deepl(text: str, target_lang: str = "ZH") -> str:
    """
    调用 DeepL API 翻译文本（保留作为备选）
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


def get_baidu_translation_usage() -> dict:
    """
    查询百度翻译 API 使用量（需在管理后台查看，此处返回占位）
    """
    return {
        "message": "请前往百度翻译开放平台管理后台查看使用量",
        "docs_url": "https://fanyi-api.baidu.com/",
    }


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


def _split_long_text(text: str, max_length: int = BAIDU_MAX_PARAGRAPH_LENGTH) -> List[str]:
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


def translate_article(db: Session, article: models.Article) -> models.Article:
    """
    翻译整篇文章（按段落切分）
    优先使用百度翻译，失败则回退到 DeepL
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
        if len(para) > BAIDU_MAX_PARAGRAPH_LENGTH:
            sub_paragraphs = _split_long_text(para)
            sub_translated = []
            for sub in sub_paragraphs:
                translated = _translate_with_fallback(sub, "zh")
                sub_translated.append(translated)
            translated_paragraphs.append("\n".join(sub_translated))
        else:
            translated = _translate_with_fallback(para, "zh")
            translated_paragraphs.append(translated)

    # 合并翻译结果
    article.translated_text = "\n\n".join(translated_paragraphs)
    article.detected_language = "en"
    article.word_count = len(original_text.split())

    db.add(article)
    db.commit()
    db.refresh(article)
    return article


def _translate_with_fallback(text: str, target_lang: str = "zh") -> str:
    """
    翻译文本，优先百度，失败则回退 DeepL
    """
    # 优先使用百度翻译
    if settings.baidu_appid and settings.baidu_secret_key:
        try:
            return translate_with_baidu(text, target_lang)
        except Exception as e:
            print(f"[翻译] 百度翻译失败，回退到 DeepL: {e}")

    # 回退到 DeepL
    if settings.deepl_api_key:
        return translate_with_deepl(text, "ZH")

    raise ValueError("未配置任何翻译服务")


def translate_text(text: str) -> str:
    """
    快速翻译文本（不保存到数据库）
    """
    if not text.strip():
        return ""

    return _translate_with_fallback(text, "zh")


def translate_text_preserving_paragraphs(text: str) -> str:
    """
    快速翻译文本并保留段落结构（按空行分段，逐段翻译后用空行拼接）
    """
    if not text.strip():
        return ""

    paragraphs = split_paragraphs(text)
    if not paragraphs:
        return ""

    translated_paragraphs: List[str] = []
    for para in paragraphs:
        if len(para) > BAIDU_MAX_PARAGRAPH_LENGTH:
            sub_paragraphs = _split_long_text(para)
            sub_translated = []
            for sub in sub_paragraphs:
                translated = _translate_with_fallback(sub, "zh")
                sub_translated.append(translated)
            translated_paragraphs.append("\n".join(sub_translated))
        else:
            translated = _translate_with_fallback(para, "zh")
            translated_paragraphs.append(translated)

    return "\n\n".join(translated_paragraphs)
