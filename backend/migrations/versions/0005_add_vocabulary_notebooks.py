"""Add vocabulary_notebooks table

Revision ID: 0005_add_vocabulary_notebooks
Revises: 0004_add_note_to_articles
Create Date: 2026-03-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0005_add_vocabulary_notebooks'
down_revision = '0004_add_note_to_articles'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 创建词汇本表
    op.create_table(
        'vocabulary_notebooks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_vocabulary_notebooks_id', 'vocabulary_notebooks', ['id'])
    op.create_index('ix_vocabulary_notebooks_user_id', 'vocabulary_notebooks', ['user_id'])

    # 给 vocabulary 表添加 notebook_id 字段
    op.add_column('vocabulary', sa.Column('notebook_id', sa.Integer(), sa.ForeignKey('vocabulary_notebooks.id'), nullable=True))
    op.create_index('ix_vocabulary_notebook_id', 'vocabulary', ['notebook_id'])


def downgrade() -> None:
    op.drop_index('ix_vocabulary_notebook_id', table_name='vocabulary')
    op.drop_column('vocabulary', 'notebook_id')
    op.drop_index('ix_vocabulary_notebooks_user_id', table_name='vocabulary_notebooks')
    op.drop_index('ix_vocabulary_notebooks_id', table_name='vocabulary_notebooks')
    op.drop_table('vocabulary_notebooks')
