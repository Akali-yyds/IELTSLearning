"""Add vocabulary, review_logs and daily_review_tasks

Revision ID: 0002_vocab_and_review
Revises: 0001_init_schema
Create Date: 2026-03-12 00:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_vocab_and_review"
down_revision: Union[str, None] = "0001_init_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vocabulary",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("word", sa.String(length=128), nullable=False),
        sa.Column("lemma", sa.String(length=128), nullable=True),
        sa.Column("phonetic", sa.String(length=64), nullable=True),
        sa.Column("meanings_json", sa.Text, nullable=True),
        sa.Column("pronunciation_url", sa.String(length=512), nullable=True),
        sa.Column("source_article_id", sa.Integer, nullable=True),
        sa.Column("source_sentence", sa.Text, nullable=True),
        sa.Column(
            "added_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("familiarity_score", sa.Integer, nullable=False, server_default="0"),
        sa.Column("ease_factor", sa.Integer, nullable=False, server_default="250"),
        sa.Column("interval_days", sa.Integer, nullable=False, server_default="1"),
        sa.Column("next_review_at", sa.Date, nullable=True),
        sa.Column("review_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("lapse_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_review_at", sa.DateTime, nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="'new'"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_article_id"], ["articles.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_vocabulary_id", "vocabulary", ["id"])
    op.create_index("ix_vocabulary_user_id", "vocabulary", ["user_id"])

    op.create_table(
        "review_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("vocab_id", sa.Integer, nullable=False),
        sa.Column("feedback", sa.String(length=32), nullable=False),
        sa.Column("previous_familiarity", sa.Integer, nullable=False),
        sa.Column("new_familiarity", sa.Integer, nullable=False),
        sa.Column("previous_interval", sa.Integer, nullable=False),
        sa.Column("new_interval", sa.Integer, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vocab_id"], ["vocabulary.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_review_logs_id", "review_logs", ["id"])
    op.create_index("ix_review_logs_user_id", "review_logs", ["user_id"])
    op.create_index("ix_review_logs_vocab_id", "review_logs", ["vocab_id"])

    op.create_table(
        "daily_review_tasks",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=False),
        sa.Column("task_date", sa.Date, nullable=False),
        sa.Column("vocab_ids", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_daily_review_tasks_id", "daily_review_tasks", ["id"])
    op.create_index("ix_daily_review_tasks_user_id", "daily_review_tasks", ["user_id"])
    op.create_index(
        "ix_daily_review_tasks_user_date",
        "daily_review_tasks",
        ["user_id", "task_date"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_daily_review_tasks_user_date", table_name="daily_review_tasks")
    op.drop_index("ix_daily_review_tasks_user_id", table_name="daily_review_tasks")
    op.drop_index("ix_daily_review_tasks_id", table_name="daily_review_tasks")
    op.drop_table("daily_review_tasks")

    op.drop_index("ix_review_logs_vocab_id", table_name="review_logs")
    op.drop_index("ix_review_logs_user_id", table_name="review_logs")
    op.drop_index("ix_review_logs_id", table_name="review_logs")
    op.drop_table("review_logs")

    op.drop_index("ix_vocabulary_user_id", table_name="vocabulary")
    op.drop_index("ix_vocabulary_id", table_name="vocabulary")
    op.drop_table("vocabulary")

