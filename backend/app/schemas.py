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
    note: Optional[str] = None


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
    # ECDICT 扩展字段
    chinese_translation: Optional[str] = None
    english_definition: Optional[str] = None
    uk_phonetic: Optional[str] = None
    us_phonetic: Optional[str] = None
    uk_audio: Optional[str] = None
    us_audio: Optional[str] = None
    tags: Optional[str] = None
    collins: Optional[int] = None
    oxford: Optional[bool] = None
    meanings_json: Optional[str] = None
    pronunciation_url: Optional[str] = None
    source_article_id: Optional[int] = None
    source_sentence: Optional[str] = None
    notebook_id: Optional[int] = None


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


# 词汇本（生词本）Schema
class VocabularyNotebookBase(BaseModel):
    name: str
    note: Optional[str] = None


class VocabularyNotebookCreate(VocabularyNotebookBase):
    pass


class VocabularyNotebookRead(VocabularyNotebookBase):
    id: int
    created_at: datetime
    updated_at: datetime
    word_count: int = 0

    class Config:
        from_attributes = True


class VocabularyNotebookUpdate(BaseModel):
    name: Optional[str] = None
    note: Optional[str] = None


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


class RecentArticle(BaseModel):
    id: int
    title: str
    word_count: int
    updated_at: datetime


class DashboardOverview(BaseModel):
    total_vocab: int
    mastered_count: int
    pending_review: int
    today_review_done: int
    streak_days: int = 0
    recent_articles: List[RecentArticle] = []


class DailyReviewStat(BaseModel):
    date: str
    total: int
    unknown: int = 0
    vague: int = 0
    known: int = 0


class StatusCounts(BaseModel):
    new: int = 0
    learning: int = 0
    reviewing: int = 0
    mastered: int = 0


class StatsData(BaseModel):
    total_vocab: int
    status_counts: StatusCounts
    review_stats: List[DailyReviewStat]
    streak_days: int = 0
    total_articles: int = 0
    total_words: int = 0


class UserSettingsBase(BaseModel):
    daily_review_target: int = Field(default=20, ge=5, le=100)


class UserSettingsRead(UserSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserSettingsUpdate(BaseModel):
    daily_review_target: Optional[int] = Field(default=None, ge=5, le=100)


