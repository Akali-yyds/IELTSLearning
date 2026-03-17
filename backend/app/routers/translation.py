from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.translation import translate_article

router = APIRouter(prefix="/articles", tags=["translation"])


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

