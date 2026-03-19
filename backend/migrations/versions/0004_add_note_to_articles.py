"""Add note field to articles

Revision ID: 0004_add_note_to_articles
Revises: 0003
Create Date: 2026-03-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0004_add_note_to_articles'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('articles', sa.Column('note', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('articles', 'note')
