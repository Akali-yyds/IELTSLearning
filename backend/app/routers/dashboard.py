from typing import List, Optional
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services import review as review_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=schemas.DashboardOverview)
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # 1. 生词本总量
    total_vocab = (
        db.query(func.count(models.Vocabulary.id))
        .filter(models.Vocabulary.user_id == current_user.id)
        .scalar()
        or 0
    )

    # 2. 已掌握数量
    mastered_count = (
        db.query(func.count(models.Vocabulary.id))
        .filter(
            models.Vocabulary.user_id == current_user.id,
            models.Vocabulary.status == "mastered",
        )
        .scalar()
        or 0
    )

    # 3. 今日待复习数量
    today = date.today()
    pending_review = (
        db.query(func.count(models.Vocabulary.id))
        .filter(
            models.Vocabulary.user_id == current_user.id,
            models.Vocabulary.next_review_at <= today,
            models.Vocabulary.status.in_(["learning", "reviewing"]),
        )
        .scalar()
        or 0
    )

    # 4. 今日已完成复习数量（今天创建的复习记录）
    today_start = datetime.combine(today, datetime.min.time())
    today_done = (
        db.query(func.count(models.ReviewLog.id))
        .filter(
            models.ReviewLog.user_id == current_user.id,
            models.ReviewLog.created_at >= today_start,
        )
        .scalar()
        or 0
    )

    # 5. 连续学习天数（基于复习记录）
    streak_days = calculate_streak_days(db, current_user.id)

    # 6. 最近阅读的文章（最近5篇）
    recent_articles = (
        db.query(models.Article)
        .filter(models.Article.user_id == current_user.id)
        .order_by(models.Article.updated_at.desc())
        .limit(5)
        .all()
    )

    return schemas.DashboardOverview(
        total_vocab=total_vocab,
        mastered_count=mastered_count,
        pending_review=pending_review,
        today_review_done=today_done,
        streak_days=streak_days,
        recent_articles=[
            schemas.RecentArticle(
                id=a.id,
                title=a.title,
                word_count=a.word_count or 0,
                updated_at=a.updated_at,
            )
            for a in recent_articles
        ],
    )


def calculate_streak_days(db: Session, user_id: int) -> int:
    """计算连续学习天数"""
    # 获取用户所有复习记录的日期（去重）
    dates = (
        db.query(func.date(models.ReviewLog.created_at))
        .filter(models.ReviewLog.user_id == user_id)
        .distinct()
        .order_by(func.date(models.ReviewLog.created_at).desc())
        .all()
    )

    if not dates:
        return 0

    date_list = [d[0] for d in dates]
    if not date_list:
        return 0

    streak = 0
    today = date.today()
    check_date = today

    for d in date_list:
        if d == check_date:
            streak += 1
            check_date = date.fromordinal(check_date.toordinal() - 1)
        elif d == date.fromordinal(check_date.toordinal() - 1):
            # 如果今天还没复习，但昨天有，连续天数从昨天开始算
            streak += 1
            check_date = date.fromordinal(d.toordinal() - 1)
        else:
            break

    return streak


@router.get("/stats", response_model=schemas.StatsData)
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    days: int = Query(default=30, ge=7, le=365),
):
    """获取学习统计数据"""
    today = date.today()
    start_date = today - timedelta(days=days)

    # 1. 词汇统计
    total_vocab = (
        db.query(func.count(models.Vocabulary.id))
        .filter(models.Vocabulary.user_id == current_user.id)
        .scalar()
        or 0
    )

    status_counts = {
        "new": 0,
        "learning": 0,
        "reviewing": 0,
        "mastered": 0,
    }
    for status in status_counts.keys():
        count = (
            db.query(func.count(models.Vocabulary.id))
            .filter(
                models.Vocabulary.user_id == current_user.id,
                models.Vocabulary.status == status,
            )
            .scalar()
            or 0
        )
        status_counts[status] = count

    # 2. 复习统计（最近 N 天）
    review_stats = []
    for i in range(days):
        d = today - timedelta(days=i)
        day_start = datetime.combine(d, datetime.min.time())
        day_end = datetime.combine(d, datetime.max.time())

        count = (
            db.query(func.count(models.ReviewLog.id))
            .filter(
                models.ReviewLog.user_id == current_user.id,
                models.ReviewLog.created_at >= day_start,
                models.ReviewLog.created_at <= day_end,
            )
            .scalar()
            or 0
        )

        # 统计各反馈类型
        unknown = (
            db.query(func.count(models.ReviewLog.id))
            .filter(
                models.ReviewLog.user_id == current_user.id,
                models.ReviewLog.created_at >= day_start,
                models.ReviewLog.created_at <= day_end,
                models.ReviewLog.feedback == "unknown",
            )
            .scalar()
            or 0
        )
        vague = (
            db.query(func.count(models.ReviewLog.id))
            .filter(
                models.ReviewLog.user_id == current_user.id,
                models.ReviewLog.created_at >= day_start,
                models.ReviewLog.created_at <= day_end,
                models.ReviewLog.feedback == "vague",
            )
            .scalar()
            or 0
        )
        known = (
            db.query(func.count(models.ReviewLog.id))
            .filter(
                models.ReviewLog.user_id == current_user.id,
                models.ReviewLog.created_at >= day_start,
                models.ReviewLog.created_at <= day_end,
                models.ReviewLog.feedback == "known",
            )
            .scalar()
            or 0
        )

        review_stats.append(
            schemas.DailyReviewStat(
                date=d.isoformat(),
                total=count,
                unknown=unknown,
                vague=vague,
                known=known,
            )
        )

    # 3. 连续学习天数
    streak_days = calculate_streak_days(db, current_user.id)

    # 4. 文章统计
    total_articles = (
        db.query(func.count(models.Article.id))
        .filter(models.Article.user_id == current_user.id)
        .scalar()
        or 0
    )

    total_words = (
        db.query(func.sum(models.Article.word_count))
        .filter(models.Article.user_id == current_user.id)
        .scalar()
        or 0
    )

    return schemas.StatsData(
        total_vocab=total_vocab,
        status_counts=status_counts,
        review_stats=review_stats,
        streak_days=streak_days,
        total_articles=total_articles,
        total_words=total_words,
    )
