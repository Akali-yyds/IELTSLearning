"""Add ECDICT-based fields to vocabulary table

Revision ID: 0006_ecdict_vocab_fields
Revises: 0005_add_vocabulary_notebooks
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa


revision = '0006_ecdict_vocab_fields'
down_revision = '0005_add_vocabulary_notebooks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('vocabulary', sa.Column('chinese_translation', sa.Text(), nullable=True))
    op.add_column('vocabulary', sa.Column('english_definition', sa.Text(), nullable=True))
    op.add_column('vocabulary', sa.Column('uk_phonetic', sa.String(length=64), nullable=True))
    op.add_column('vocabulary', sa.Column('us_phonetic', sa.String(length=64), nullable=True))
    op.add_column('vocabulary', sa.Column('uk_audio', sa.String(length=512), nullable=True))
    op.add_column('vocabulary', sa.Column('us_audio', sa.String(length=512), nullable=True))
    op.add_column('vocabulary', sa.Column('tags', sa.String(length=128), nullable=True))
    op.add_column('vocabulary', sa.Column('collins', sa.Integer(), nullable=True))
    op.add_column('vocabulary', sa.Column('oxford', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('vocabulary', 'oxford')
    op.drop_column('vocabulary', 'collins')
    op.drop_column('vocabulary', 'tags')
    op.drop_column('vocabulary', 'us_audio')
    op.drop_column('vocabulary', 'uk_audio')
    op.drop_column('vocabulary', 'us_phonetic')
    op.drop_column('vocabulary', 'uk_phonetic')
    op.drop_column('vocabulary', 'english_definition')
    op.drop_column('vocabulary', 'chinese_translation')
