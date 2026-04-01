"""add bnc frq to vocabulary

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_add_bnc_frq"
down_revision = "0006_ecdict_vocab_fields"


def upgrade() -> None:
    op.add_column("vocabulary", sa.Column("bnc", sa.Integer(), nullable=True))
    op.add_column("vocabulary", sa.Column("frq", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("vocabulary", "frq")
    op.drop_column("vocabulary", "bnc")
