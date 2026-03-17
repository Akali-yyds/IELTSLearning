from typing import Optional

from sqlalchemy.orm import Session

from .. import models


def translate_article(db: Session, article: models.Article) -> models.Article:
    """
    占位实现：
    - 当前不接第三方翻译服务，只做一个非常简单的“伪翻译”（原文直接返回）
    - 保留结构和缓存位点，后续可接入真实翻译 API。
    """
    if article.translated_text:
        return article

    article.translated_text = article.original_text
    article.detected_language = "en"
    article.word_count = len(article.original_text.split())

    db.add(article)
    db.commit()
    db.refresh(article)
    return article

