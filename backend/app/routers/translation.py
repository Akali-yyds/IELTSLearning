from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.translation import translate_article, translate_text_preserving_paragraphs

router = APIRouter(prefix="/articles", tags=["translation"])


class QuickTranslateRequest(BaseModel):
    text: str


class QuickTranslateResponse(BaseModel):
    translated_text: str


# 快速翻译（不需要保存文章）
router_translation = APIRouter(prefix="/translation", tags=["translation"])


@router_translation.post("/quick", response_model=QuickTranslateResponse)
def quick_translate(
    payload: QuickTranslateRequest,
):
    """快速翻译文本（不保存到数据库）"""
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    translated = translate_text_preserving_paragraphs(payload.text)
    return QuickTranslateResponse(translated_text=translated)


@router.post("/{article_id}/translate", response_model=schemas.ArticleRead)
def translate_article_endpoint(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    article = (
        db.query(models.Article)
        .filter(
            models.Article.id == article_id,
            models.Article.user_id == current_user.id,
        )
        .first()
    )
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    article = translate_article(db, article)
    return article
