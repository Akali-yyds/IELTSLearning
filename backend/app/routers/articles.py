from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/articles", tags=["articles"])


@router.post("/", response_model=schemas.ArticleRead, status_code=status.HTTP_201_CREATED)
def create_article(
    payload: schemas.ArticleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    article = models.Article(
        user_id=current_user.id,
        title=payload.title,
        original_text=payload.original_text,
        word_count=len(payload.original_text.split()),
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.get("/", response_model=List[schemas.ArticleRead])
def list_articles(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.Article)
        .filter(models.Article.user_id == current_user.id)
        .order_by(models.Article.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(query)


@router.get("/{article_id}", response_model=schemas.ArticleRead)
def get_article(
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
    return article


@router.put("/{article_id}", response_model=schemas.ArticleRead)
def update_article(
    article_id: int,
    payload: schemas.ArticleUpdate,
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

    if payload.title is not None:
        article.title = payload.title
    if payload.original_text is not None:
        article.original_text = payload.original_text
        article.word_count = len(payload.original_text.split())

    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
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
    db.delete(article)
    db.commit()
    return None

