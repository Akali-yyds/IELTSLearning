from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/vocabulary", tags=["vocabulary"])


@router.post("/", response_model=schemas.VocabularyRead, status_code=status.HTTP_201_CREATED)
def add_to_vocabulary(
    payload: schemas.VocabularyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.user_id == current_user.id,
            models.Vocabulary.lemma == (payload.lemma or payload.word.lower()),
        )
        .first()
    )
    if existing:
        return existing

    vocab = models.Vocabulary(
        user_id=current_user.id,
        word=payload.word,
        lemma=payload.lemma or payload.word.lower(),
        phonetic=payload.phonetic,
        meanings_json=payload.meanings_json,
        pronunciation_url=payload.pronunciation_url,
        source_article_id=payload.source_article_id,
        source_sentence=payload.source_sentence,
        status="new",
    )
    db.add(vocab)
    db.commit()
    db.refresh(vocab)
    return vocab


@router.get("/", response_model=List[schemas.VocabularyRead])
def list_vocabulary(
    status_filter: str | None = Query(default=None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Vocabulary).filter(models.Vocabulary.user_id == current_user.id)
    if status_filter:
        query = query.filter(models.Vocabulary.status == status_filter)
    query = query.order_by(models.Vocabulary.added_at.desc()).offset(skip).limit(limit)
    return list(query)


@router.get("/{vocab_id}", response_model=schemas.VocabularyRead)
def get_vocabulary_item(
    vocab_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    vocab = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.id == vocab_id,
            models.Vocabulary.user_id == current_user.id,
        )
        .first()
    )
    if not vocab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found")
    return vocab


@router.delete("/{vocab_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vocabulary_item(
    vocab_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    vocab = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.id == vocab_id,
            models.Vocabulary.user_id == current_user.id,
        )
        .first()
    )
    if not vocab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found")
    db.delete(vocab)
    db.commit()
    return None

