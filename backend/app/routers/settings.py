from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=schemas.UserSettingsRead)
def get_user_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取用户设置"""
    settings = (
        db.query(models.UserSettings)
        .filter(models.UserSettings.user_id == current_user.id)
        .first()
    )
    if not settings:
        # 如果没有设置，创建默认设置
        settings = models.UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("", response_model=schemas.UserSettingsRead)
def update_user_settings(
    payload: schemas.UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """更新用户设置"""
    settings = (
        db.query(models.UserSettings)
        .filter(models.UserSettings.user_id == current_user.id)
        .first()
    )
    if not settings:
        # 如果没有设置，创建新设置
        settings = models.UserSettings(user_id=current_user.id)
        db.add(settings)
    
    if payload.daily_review_target is not None:
        settings.daily_review_target = payload.daily_review_target
    
    db.commit()
    db.refresh(settings)
    return settings
