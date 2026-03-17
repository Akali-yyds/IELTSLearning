from datetime import date, datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from .. import models


def _today() -> date:
    return date.today()


def generate_today_tasks(db: Session, user_id: int, daily_limit: int = 20) -> models.DailyReviewTask:
    today = _today()

    existing = (
        db.query(models.DailyReviewTask)
        .filter(
            models.DailyReviewTask.user_id == user_id,
            models.DailyReviewTask.task_date == today,
        )
        .first()
    )
    if existing:
        return existing

    due_words = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.user_id == user_id,
            models.Vocabulary.next_review_at <= today,
        )
        .order_by(
            models.Vocabulary.next_review_at.asc(),
            models.Vocabulary.familiarity_score.asc(),
        )
        .limit(daily_limit)
        .all()
    )

    if len(due_words) < daily_limit:
        remaining = daily_limit - len(due_words)
        new_words = (
            db.query(models.Vocabulary)
            .filter(
                models.Vocabulary.user_id == user_id,
                models.Vocabulary.status == "new",
            )
            .order_by(models.Vocabulary.added_at.asc())
            .limit(remaining)
            .all()
        )
        words = due_words + new_words
    else:
        words = due_words

    ids = [str(v.id) for v in words]
    task = models.DailyReviewTask(
        user_id=user_id,
        task_date=today,
        vocab_ids=",".join(ids),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _update_vocabulary_for_feedback(vocab: models.Vocabulary, feedback: str) -> None:
    now = datetime.utcnow()
    vocab.review_count += 1
    vocab.last_review_at = now
    current_interval = vocab.interval_days or 1
    familiarity = vocab.familiarity_score

    if feedback == "unknown":
        vocab.familiarity_score = max(0, familiarity - 30)
        vocab.interval_days = 1
        vocab.lapse_count += 1
        vocab.status = "learning"
    elif feedback == "vague":
        vocab.familiarity_score = min(100, familiarity + 5)
        vocab.interval_days = min(current_interval + 1, 30)
        vocab.status = "reviewing"
    elif feedback == "known":
        vocab.familiarity_score = min(100, familiarity + 10)
        vocab.interval_days = min(current_interval * 2, 60)
        vocab.status = "reviewing"
    elif feedback == "very_known":
        vocab.familiarity_score = min(100, familiarity + 20)
        vocab.interval_days = min(current_interval * 3, 120)
        vocab.status = "mastered"
    else:
        vocab.familiarity_score = min(100, familiarity + 5)

    vocab.next_review_at = _today() + timedelta(days=vocab.interval_days)


def apply_review_feedback(
    db: Session,
    user_id: int,
    vocab: models.Vocabulary,
    feedback: str,
) -> models.ReviewLog:
    previous_familiarity = vocab.familiarity_score
    previous_interval = vocab.interval_days

    _update_vocabulary_for_feedback(vocab, feedback)

    log = models.ReviewLog(
        user_id=user_id,
        vocab_id=vocab.id,
        feedback=feedback,
        previous_familiarity=previous_familiarity,
        new_familiarity=vocab.familiarity_score,
        previous_interval=previous_interval,
        new_interval=vocab.interval_days,
    )
    db.add(vocab)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def parse_task_vocab_ids(task: models.DailyReviewTask, db: Session) -> List[models.Vocabulary]:
    if not task.vocab_ids:
        return []
    ids = [int(x) for x in task.vocab_ids.split(",") if x]
    if not ids:
        return []
    return (
        db.query(models.Vocabulary)
        .filter(models.Vocabulary.id.in_(ids))
        .order_by(models.Vocabulary.id.asc())
        .all()
    )

