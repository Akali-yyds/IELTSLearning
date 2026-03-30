from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    articles = relationship("Article", back_populates="owner")
    vocabulary_notebooks = relationship("VocabularyNotebook", back_populates="owner")
    vocabulary = relationship("Vocabulary", back_populates="owner")
    review_logs = relationship("ReviewLog", back_populates="owner")
    settings = relationship("UserSettings", back_populates="user", uselist=False)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    daily_review_target = Column(Integer, default=20, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="settings")


class VocabularyNotebook(Base):
    """词汇本（生词本）"""
    __tablename__ = "vocabulary_notebooks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="vocabulary_notebooks")
    vocabulary_items = relationship("Vocabulary", back_populates="notebook")


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    detected_language = Column(String(32), nullable=True)
    word_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    owner = relationship("User", back_populates="articles")


class Vocabulary(Base):
    __tablename__ = "vocabulary"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notebook_id = Column(Integer, ForeignKey("vocabulary_notebooks.id"), nullable=True, index=True)
    word = Column(String(128), nullable=False)
    lemma = Column(String(128), nullable=True)
    phonetic = Column(String(64), nullable=True)
    # ECDICT 扩展字段
    chinese_translation = Column(Text, nullable=True)
    english_definition = Column(Text, nullable=True)
    uk_phonetic = Column(String(64), nullable=True)
    us_phonetic = Column(String(64), nullable=True)
    uk_audio = Column(String(512), nullable=True)
    us_audio = Column(String(512), nullable=True)
    tags = Column(String(128), nullable=True)       # 空格分隔: "ielts toefl gre"
    collins = Column(Integer, nullable=True)        # 柯林斯星级 0-5
    oxford = Column(Boolean, nullable=True)         # 牛津3000
    meanings_json = Column(Text, nullable=True)     # {meanings, sentences, phrases, synonyms}
    pronunciation_url = Column(String(512), nullable=True)
    source_article_id = Column(Integer, ForeignKey("articles.id"), nullable=True)
    source_sentence = Column(Text, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    familiarity_score = Column(Integer, default=0, nullable=False)
    ease_factor = Column(Integer, default=250, nullable=False)
    interval_days = Column(Integer, default=1, nullable=False)
    next_review_at = Column(Date, nullable=True)
    review_count = Column(Integer, default=0, nullable=False)
    lapse_count = Column(Integer, default=0, nullable=False)
    last_review_at = Column(DateTime, nullable=True)
    status = Column(String(32), default="new", nullable=False)

    owner = relationship("User", back_populates="vocabulary")
    notebook = relationship("VocabularyNotebook", back_populates="vocabulary_items")
    source_article = relationship("Article")
    review_logs = relationship("ReviewLog", back_populates="vocab")


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    vocab_id = Column(Integer, ForeignKey("vocabulary.id"), nullable=False, index=True)
    feedback = Column(String(32), nullable=False)
    previous_familiarity = Column(Integer, nullable=False)
    new_familiarity = Column(Integer, nullable=False)
    previous_interval = Column(Integer, nullable=False)
    new_interval = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="review_logs")
    vocab = relationship("Vocabulary", back_populates="review_logs")


class DailyReviewTask(Base):
    __tablename__ = "daily_review_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    task_date = Column(Date, nullable=False, index=True)
    vocab_ids = Column(Text, nullable=False)  # comma separated vocab ids snapshot
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


