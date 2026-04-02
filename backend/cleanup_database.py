from __future__ import annotations

import argparse
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal


@dataclass
class CleanupStats:
    orphan_vocab_deleted: int = 0
    orphan_logs_deleted: int = 0
    tasks_deleted: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean orphan learning data from the local database.")
    parser.add_argument("--email", default="", help="Only clean data for the specified user email.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without committing.")
    return parser.parse_args()


def iter_target_users(db: Session, email: str) -> list[models.User]:
    query = db.query(models.User)
    if email:
        query = query.filter(models.User.email == email)
    return query.order_by(models.User.id.asc()).all()


def cleanup_user(db: Session, user: models.User, dry_run: bool) -> CleanupStats:
    stats = CleanupStats()

    orphan_vocab_ids = [
        vocab_id
        for (vocab_id,) in (
            db.query(models.Vocabulary.id)
            .filter(
                models.Vocabulary.user_id == user.id,
                models.Vocabulary.notebook_id.is_(None),
            )
            .all()
        )
    ]

    if orphan_vocab_ids:
        orphan_logs_query = (
            db.query(models.ReviewLog)
            .filter(
                models.ReviewLog.user_id == user.id,
                models.ReviewLog.vocab_id.in_(orphan_vocab_ids),
            )
        )
        stats.orphan_logs_deleted = orphan_logs_query.count()
        if not dry_run:
            orphan_logs_query.delete(synchronize_session=False)

        orphan_vocab_query = (
            db.query(models.Vocabulary)
            .filter(
                models.Vocabulary.user_id == user.id,
                models.Vocabulary.id.in_(orphan_vocab_ids),
            )
        )
        stats.orphan_vocab_deleted = orphan_vocab_query.count()
        if not dry_run:
            orphan_vocab_query.delete(synchronize_session=False)

    tasks_query = db.query(models.DailyReviewTask).filter(models.DailyReviewTask.user_id == user.id)
    stats.tasks_deleted = tasks_query.count()
    if not dry_run and stats.tasks_deleted:
        tasks_query.delete(synchronize_session=False)

    return stats


def reset_sequences(db: Session) -> None:
    tables = [
        "articles",
        "vocabulary_notebooks",
        "vocabulary",
        "review_logs",
        "daily_review_tasks",
    ]
    for table in tables:
        seq = db.execute(text("SELECT pg_get_serial_sequence(:table, 'id')"), {"table": table}).scalar()
        if not seq:
            continue
        max_id = db.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table}")).scalar() or 0
        db.execute(text("SELECT setval(:seq, :value, :is_called)"), {
            "seq": seq,
            "value": max_id if max_id > 0 else 1,
            "is_called": max_id > 0,
        })


def main() -> int:
    args = parse_args()
    db = SessionLocal()
    try:
        users = iter_target_users(db, args.email)
        if not users:
            print("No matching users found.")
            return 0

        for user in users:
            stats = cleanup_user(db, user, args.dry_run)
            print({
                "user_id": user.id,
                "email": user.email,
                "orphan_vocab_deleted": stats.orphan_vocab_deleted,
                "orphan_logs_deleted": stats.orphan_logs_deleted,
                "tasks_deleted": stats.tasks_deleted,
                "dry_run": args.dry_run,
            })

        if args.dry_run:
            db.rollback()
            print("Dry run complete. No changes were committed.")
            return 0

        reset_sequences(db)
        db.commit()
        print("Cleanup complete.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
