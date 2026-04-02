from datetime import date, datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from .. import models


def _today() -> date:
    return date.today()


def _unique_ids(values: list[int]) -> list[int]:
    seen: set[int] = set()
    result: list[int] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def _active_vocab_query(db: Session, user_id: int):
    return db.query(models.Vocabulary).filter(
        models.Vocabulary.user_id == user_id,
        models.Vocabulary.notebook_id.isnot(None),
    )


def _build_today_task_ids(
    db: Session,
    user_id: int,
    daily_limit: int,
    seed_ids: list[int] | None = None,
) -> list[int]:
    selected_ids = _unique_ids(seed_ids or [])

    def extend_from_words(words: list[models.Vocabulary]) -> None:
        nonlocal selected_ids
        for word in words:
            if len(selected_ids) >= daily_limit:
                return
            if word.id not in selected_ids:
                selected_ids.append(word.id)

    active_query = _active_vocab_query(db, user_id)

    if len(selected_ids) < daily_limit:
        due_words = (
            active_query
            .filter(models.Vocabulary.next_review_at <= _today())
            .order_by(
                models.Vocabulary.next_review_at.asc(),
                models.Vocabulary.familiarity_score.asc(),
            )
            .all()
        )
        extend_from_words(due_words)

    if len(selected_ids) < daily_limit:
        new_words = (
            active_query
            .filter(models.Vocabulary.status == "new")
            .order_by(models.Vocabulary.added_at.asc())
            .all()
        )
        extend_from_words(new_words)

    return selected_ids[:daily_limit]


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
        existing_ids = _unique_ids([int(x) for x in existing.vocab_ids.split(",") if x])
        valid_existing_ids = {
            vocab_id
            for (vocab_id,) in (
                _active_vocab_query(db, user_id)
                .filter(models.Vocabulary.id.in_(existing_ids))
                .with_entities(models.Vocabulary.id)
                .all()
            )
        }
        sanitized_seed_ids = [vocab_id for vocab_id in existing_ids if vocab_id in valid_existing_ids]
        refreshed_ids = _build_today_task_ids(db, user_id, daily_limit, seed_ids=sanitized_seed_ids)
        refreshed_value = ",".join(str(vocab_id) for vocab_id in refreshed_ids)
        if existing.vocab_ids != refreshed_value:
            existing.vocab_ids = refreshed_value
            db.add(existing)
            db.commit()
            db.refresh(existing)
        return existing

    ids = [str(vocab_id) for vocab_id in _build_today_task_ids(db, user_id, daily_limit)]
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
    ids = _unique_ids([int(x) for x in task.vocab_ids.split(",") if x])
    if not ids:
        return []
    rows = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.id.in_(ids),
            models.Vocabulary.notebook_id.isnot(None),
        )
        .all()
    )
    row_map = {row.id: row for row in rows}
    return [row_map[vocab_id] for vocab_id in ids if vocab_id in row_map]

