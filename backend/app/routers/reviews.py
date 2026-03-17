from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services import review as review_service

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/today", response_model=List[schemas.ReviewItem])
def get_today_reviews(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = review_service.generate_today_tasks(db, current_user.id)
    vocab_items = review_service.parse_task_vocab_ids(task, db)
    return [schemas.ReviewItem(vocab=v) for v in vocab_items]


@router.post("/{vocab_id}/submit", response_model=schemas.ReviewHistoryItem)
def submit_review_feedback(
    vocab_id: int,
    payload: schemas.ReviewFeedbackRequest,
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
        raise HTTPException(status_code=404, detail="Vocabulary not found")

    log = review_service.apply_review_feedback(
        db=db,
        user_id=current_user.id,
        vocab=vocab,
        feedback=payload.feedback,
    )
    return schemas.ReviewHistoryItem(
        id=log.id,
        vocab_id=log.vocab_id,
        feedback=log.feedback,
        previous_familiarity=log.previous_familiarity,
        new_familiarity=log.new_familiarity,
        previous_interval=log.previous_interval,
        new_interval=log.new_interval,
        created_at=log.created_at,
    )


@router.get("/history", response_model=List[schemas.ReviewHistoryItem])
def get_review_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
):
    logs = (
        db.query(models.ReviewLog)
        .filter(models.ReviewLog.user_id == current_user.id)
        .order_by(models.ReviewLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        schemas.ReviewHistoryItem(
            id=log.id,
            vocab_id=log.vocab_id,
            feedback=log.feedback,
            previous_familiarity=log.previous_familiarity,
            new_familiarity=log.new_familiarity,
            previous_interval=log.previous_interval,
            new_interval=log.new_interval,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/stats/overview", response_model=schemas.StatsOverview)
def get_stats_overview(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    total_vocab = (
        db.query(func.count(models.Vocabulary.id))
        .filter(models.Vocabulary.user_id == current_user.id)
        .scalar()
        or 0
    )
    mastered_count = (
        db.query(func.count(models.Vocabulary.id))
        .filter(
            models.Vocabulary.user_id == current_user.id,
            models.Vocabulary.status == "mastered",
        )
        .scalar()
        or 0
    )
    today_target = 20
    today_done = (
        db.query(func.count(models.ReviewLog.id))
        .filter(models.ReviewLog.user_id == current_user.id)
        .scalar()
        or 0
    )

    return schemas.StatsOverview(
        total_vocab=total_vocab,
        mastered_count=mastered_count,
        today_review_target=today_target,
        today_review_done=today_done,
        streak_days=0,
    )

