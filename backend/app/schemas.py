from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=72)


class UserRead(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    type: str
    exp: int


class ArticleBase(BaseModel):
    title: str
    original_text: str


class ArticleCreate(ArticleBase):
    pass


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    original_text: Optional[str] = None


class ArticleRead(ArticleBase):
    id: int
    translated_text: Optional[str] = None
    detected_language: Optional[str] = None
    word_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VocabularyBase(BaseModel):
    word: str
    lemma: Optional[str] = None
    phonetic: Optional[str] = None
    meanings_json: Optional[str] = None
    pronunciation_url: Optional[str] = None
    source_article_id: Optional[int] = None
    source_sentence: Optional[str] = None


class VocabularyCreate(VocabularyBase):
    pass


class VocabularyRead(VocabularyBase):
    id: int
    added_at: datetime
    familiarity_score: int
    ease_factor: int
    interval_days: int
    next_review_at: Optional[date] = None
    review_count: int
    lapse_count: int
    last_review_at: Optional[datetime] = None
    status: str

    class Config:
        from_attributes = True


class ReviewFeedbackRequest(BaseModel):
    feedback: str  # "unknown" / "vague" / "known" / "very_known"


class ReviewItem(BaseModel):
    vocab: VocabularyRead


class ReviewHistoryItem(BaseModel):
    id: int
    vocab_id: int
    feedback: str
    previous_familiarity: int
    new_familiarity: int
    previous_interval: int
    new_interval: int
    created_at: datetime


class StatsOverview(BaseModel):
    total_vocab: int
    mastered_count: int
    today_review_target: int
    today_review_done: int
    streak_days: int = 0
    # 可根据后续需要再扩展


