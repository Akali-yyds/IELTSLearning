import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.pronunciation import get_pronunciation_data
from ..services.dictionary import lookup_word_smart
from ..services.tatoeba import get_example_sentences

router = APIRouter(prefix="/vocabulary", tags=["vocabulary"])


# 公开的单词查询端点（不需要登录）- 使用智能查词（词形还原）
@router.get("/lookup")
def lookup_vocabulary(word: str = Query(..., min_length=1, max_length=128)):
    """查询单词释义，先词形还原再查词典（如 adults -> adult）"""
    if not word.strip():
        raise HTTPException(status_code=400, detail="word is required")

    smart = lookup_word_smart(word)
    if smart["result"] is None:
        print(f"Lookup error: no result for word={word}, normalized={smart.get('normalized')}")
        raise HTTPException(status_code=404, detail="Word not found")

    entry = smart["result"]
    # 返回与原先一致的结构（partOfSpeech + definition/example），便于前端直接使用
    meanings = entry.get("meanings") or []
    meanings_out = []
    for m in meanings:
        defs_raw = m.get("definitions") or []
        exs_raw = m.get("examples") or []
        definitions = [
            {"definition": d, "example": exs_raw[i] if i < len(exs_raw) else ""}
            for i, d in enumerate(defs_raw)
        ]
        meanings_out.append({
            "partOfSpeech": m.get("part_of_speech", ""),
            "definitions": definitions,
        })
    out = {
        "word": entry["word"],
        "phonetic": entry.get("phonetic"),
        "chinese_translation": entry.get("chinese_translation"),
        "english_definition": entry.get("english_definition"),
        "uk_phonetic": entry.get("uk_phonetic"),
        "us_phonetic": entry.get("us_phonetic"),
        "uk_audio": entry.get("uk_audio"),
        "us_audio": entry.get("us_audio"),
        "meanings": meanings_out,
        "synonyms": entry.get("synonyms") or [],
        "sentences": entry.get("sentences") or [],
        "phrases": entry.get("phrases") or [],
        # ECDICT 扩展字段
        "tags": entry.get("tags") or {},
        "collins": entry.get("collins") or 0,
        "oxford": entry.get("oxford") or False,
        "bnc": entry.get("bnc"),
        "frq": entry.get("frq"),
        "source": entry.get("source", ""),
        "base_form": entry.get("base_form"),
    }
    # 若命中的是词根，可带给前端展示
    if smart.get("matched_word") and smart["matched_word"] != smart.get("normalized"):
        out["matched_word"] = smart["matched_word"]
        out["raw_word"] = smart.get("raw_word")
    return out


@router.get("/lookup/examples")
def lookup_vocabulary_examples(
    word: str = Query(..., min_length=1, max_length=128),
    lemma: str | None = Query(default=None, min_length=1, max_length=128),
):
    if not word.strip():
        raise HTTPException(status_code=400, detail="word is required")

    return {
        "word": lemma or word,
        "sentences": get_example_sentences(word=word, lemma=lemma or ""),
    }


@router.get("/lookup/pronunciation", response_model=schemas.VocabularyPronunciationRead)
def lookup_vocabulary_pronunciation(
    word: str = Query(..., min_length=1, max_length=128),
    lemma: str | None = Query(default=None, min_length=1, max_length=128),
):
    if not word.strip():
        raise HTTPException(status_code=400, detail="word is required")

    pronunciation = get_pronunciation_data(word=word, lemma=lemma or "", include_audio=True)
    return schemas.VocabularyPronunciationRead(
        word=lemma or word,
        phonetic=pronunciation.get("phonetic"),
        uk_phonetic=pronunciation.get("uk_phonetic"),
        us_phonetic=pronunciation.get("us_phonetic"),
        uk_audio=pronunciation.get("uk_audio"),
        us_audio=pronunciation.get("us_audio"),
    )


@router.post("/", response_model=schemas.VocabularyRead, status_code=status.HTTP_201_CREATED)
def add_to_vocabulary(
    payload: schemas.VocabularyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # 检查是否指定了笔记本
    notebook = None
    if payload.notebook_id:
        notebook = (
            db.query(models.VocabularyNotebook)
            .filter(
                models.VocabularyNotebook.id == payload.notebook_id,
                models.VocabularyNotebook.user_id == current_user.id,
            )
            .first()
        )
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")

    smart = lookup_word_smart(
        payload.lemma or payload.word,
        include_pronunciation=True,
        include_examples=True,
        include_audio=True,
    )
    enriched = smart.get("result") if smart else None

    def merge_meanings_json(existing_json: str | None, enriched_entry: dict | None) -> str | None:
        if not existing_json and not enriched_entry:
            return None

        data = {
            "meanings": [],
            "sentences": [],
            "phrases": [],
            "synonyms": [],
        }

        if existing_json:
            try:
                parsed = json.loads(existing_json)
                if isinstance(parsed, dict):
                    for key in data.keys():
                        value = parsed.get(key)
                        if isinstance(value, list):
                            data[key] = value
            except json.JSONDecodeError:
                pass

        if enriched_entry:
            if not data["meanings"]:
                data["meanings"] = enriched_entry.get("meanings") or []
            if not data["sentences"]:
                data["sentences"] = enriched_entry.get("sentences") or []
            if not data["phrases"]:
                data["phrases"] = enriched_entry.get("phrases") or []
            if not data["synonyms"]:
                data["synonyms"] = enriched_entry.get("synonyms") or []

        return json.dumps(data, ensure_ascii=False)

    # 检查单词是否已存在
    existing = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.user_id == current_user.id,
            models.Vocabulary.lemma == (payload.lemma or payload.word.lower()),
        )
        .first()
    )
    if existing:
        # 如果单词已存在，更新信息（如果有新传入的数据）
        existing.phonetic = payload.phonetic or existing.phonetic or (enriched.get("phonetic") if enriched else None)
        existing.chinese_translation = payload.chinese_translation or existing.chinese_translation or (enriched.get("chinese_translation") if enriched else None)
        existing.english_definition = payload.english_definition or existing.english_definition or (enriched.get("english_definition") if enriched else None)
        existing.uk_phonetic = payload.uk_phonetic or existing.uk_phonetic or (enriched.get("uk_phonetic") if enriched else None)
        existing.us_phonetic = payload.us_phonetic or existing.us_phonetic or (enriched.get("us_phonetic") if enriched else None)
        existing.uk_audio = payload.uk_audio or existing.uk_audio or (enriched.get("uk_audio") if enriched else None)
        existing.us_audio = payload.us_audio or existing.us_audio or (enriched.get("us_audio") if enriched else None)
        if payload.tags is not None:
            existing.tags = payload.tags
        elif enriched and not existing.tags:
            existing.tags = " ".join(k for k, v in (enriched.get("tags") or {}).items() if v)
        if payload.collins is not None:
            existing.collins = payload.collins
        elif enriched and existing.collins is None:
            existing.collins = enriched.get("collins")
        if payload.oxford is not None:
            existing.oxford = payload.oxford
        elif enriched and existing.oxford is None:
            existing.oxford = enriched.get("oxford")
        if payload.bnc is not None:
            existing.bnc = payload.bnc
        elif enriched and existing.bnc is None:
            existing.bnc = enriched.get("bnc")
        if payload.frq is not None:
            existing.frq = payload.frq
        elif enriched and existing.frq is None:
            existing.frq = enriched.get("frq")
        merged_json = merge_meanings_json(payload.meanings_json or existing.meanings_json, enriched)
        if merged_json:
            existing.meanings_json = merged_json
        if payload.pronunciation_url:
            existing.pronunciation_url = payload.pronunciation_url
        elif not existing.pronunciation_url:
            existing.pronunciation_url = (
                payload.uk_audio
                or payload.us_audio
                or existing.uk_audio
                or existing.us_audio
                or (enriched.get("uk_audio") if enriched else None)
                or (enriched.get("us_audio") if enriched else None)
            )
        # 如果指定了生词本，更新
        if payload.notebook_id and existing.notebook_id != payload.notebook_id:
            existing.notebook_id = payload.notebook_id
        db.commit()
        db.refresh(existing)
        return existing

    vocab = models.Vocabulary(
        user_id=current_user.id,
        notebook_id=payload.notebook_id,
        word=payload.word,
        lemma=payload.lemma or payload.word.lower(),
        phonetic=payload.phonetic or (enriched.get("phonetic") if enriched else None),
        chinese_translation=payload.chinese_translation or (enriched.get("chinese_translation") if enriched else None),
        english_definition=payload.english_definition or (enriched.get("english_definition") if enriched else None),
        uk_phonetic=payload.uk_phonetic or (enriched.get("uk_phonetic") if enriched else None),
        us_phonetic=payload.us_phonetic or (enriched.get("us_phonetic") if enriched else None),
        uk_audio=payload.uk_audio or (enriched.get("uk_audio") if enriched else None),
        us_audio=payload.us_audio or (enriched.get("us_audio") if enriched else None),
        tags=payload.tags or (" ".join(k for k, v in (enriched.get("tags") or {}).items() if v) if enriched else None),
        collins=payload.collins if payload.collins is not None else (enriched.get("collins") if enriched else None),
        oxford=payload.oxford if payload.oxford is not None else (enriched.get("oxford") if enriched else None),
        bnc=payload.bnc if payload.bnc is not None else (enriched.get("bnc") if enriched else None),
        frq=payload.frq if payload.frq is not None else (enriched.get("frq") if enriched else None),
        meanings_json=merge_meanings_json(payload.meanings_json, enriched),
        pronunciation_url=payload.pronunciation_url or payload.uk_audio or payload.us_audio or (enriched.get("uk_audio") if enriched else None) or (enriched.get("us_audio") if enriched else None),
        source_article_id=payload.source_article_id,
        source_sentence=payload.source_sentence,
        status="new",
    )
    db.add(vocab)
    db.commit()
    db.refresh(vocab)
    return vocab


@router.get("/", response_model=List[schemas.VocabularyRead])
def list_vocabulary(
    notebook_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Vocabulary).filter(models.Vocabulary.user_id == current_user.id)
    if notebook_id:
        query = query.filter(models.Vocabulary.notebook_id == notebook_id)
    if status_filter:
        query = query.filter(models.Vocabulary.status == status_filter)
    query = query.order_by(models.Vocabulary.added_at.desc()).offset(skip).limit(limit)
    return list(query)


# ======= 词汇本（生词本）管理 =======
# 注意：必须放在 /{vocab_id} 路由之前，避免被错误匹配

@router.get("/notebooks", response_model=List[schemas.VocabularyNotebookRead])
def list_notebooks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取用户的所有词汇本"""
    notebooks = (
        db.query(models.VocabularyNotebook)
        .filter(models.VocabularyNotebook.user_id == current_user.id)
        .order_by(models.VocabularyNotebook.created_at.desc())
        .all()
    )
    # 计算每个笔记本的单词数量
    result = []
    for nb in notebooks:
        word_count = (
            db.query(models.Vocabulary)
            .filter(models.Vocabulary.notebook_id == nb.id)
            .count()
        )
        result.append({
            "id": nb.id,
            "name": nb.name,
            "note": nb.note,
            "created_at": nb.created_at,
            "updated_at": nb.updated_at,
            "word_count": word_count,
        })
    return result


@router.post("/notebooks", response_model=schemas.VocabularyNotebookRead, status_code=status.HTTP_201_CREATED)
def create_notebook(
    payload: schemas.VocabularyNotebookCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """创建新的词汇本"""
    notebook = models.VocabularyNotebook(
        user_id=current_user.id,
        name=payload.name,
        note=payload.note,
    )
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    return {
        "id": notebook.id,
        "name": notebook.name,
        "note": notebook.note,
        "created_at": notebook.created_at,
        "updated_at": notebook.updated_at,
        "word_count": 0,
    }


@router.get("/notebooks/{notebook_id}", response_model=schemas.VocabularyNotebookRead)
def get_notebook(
    notebook_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取指定词汇本详情"""
    notebook = (
        db.query(models.VocabularyNotebook)
        .filter(
            models.VocabularyNotebook.id == notebook_id,
            models.VocabularyNotebook.user_id == current_user.id,
        )
        .first()
    )
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    word_count = (
        db.query(models.Vocabulary)
        .filter(models.Vocabulary.notebook_id == notebook_id)
        .count()
    )
    return {
        "id": notebook.id,
        "name": notebook.name,
        "note": notebook.note,
        "created_at": notebook.created_at,
        "updated_at": notebook.updated_at,
        "word_count": word_count,
    }


@router.put("/notebooks/{notebook_id}", response_model=schemas.VocabularyNotebookRead)
def update_notebook(
    notebook_id: int,
    payload: schemas.VocabularyNotebookUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """更新词汇本"""
    notebook = (
        db.query(models.VocabularyNotebook)
        .filter(
            models.VocabularyNotebook.id == notebook_id,
            models.VocabularyNotebook.user_id == current_user.id,
        )
        .first()
    )
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    if payload.name is not None:
        notebook.name = payload.name
    if payload.note is not None:
        notebook.note = payload.note

    db.commit()
    db.refresh(notebook)

    word_count = (
        db.query(models.Vocabulary)
        .filter(models.Vocabulary.notebook_id == notebook_id)
        .count()
    )
    return {
        "id": notebook.id,
        "name": notebook.name,
        "note": notebook.note,
        "created_at": notebook.created_at,
        "updated_at": notebook.updated_at,
        "word_count": word_count,
    }


@router.delete("/notebooks/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notebook(
    notebook_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """删除词汇本"""
    notebook = (
        db.query(models.VocabularyNotebook)
        .filter(
            models.VocabularyNotebook.id == notebook_id,
            models.VocabularyNotebook.user_id == current_user.id,
        )
        .first()
    )
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    vocab_ids = [
        vocab_id
        for (vocab_id,) in (
            db.query(models.Vocabulary.id)
            .filter(
                models.Vocabulary.user_id == current_user.id,
                models.Vocabulary.notebook_id == notebook_id,
            )
            .all()
        )
    ]

    if vocab_ids:
        (
            db.query(models.ReviewLog)
            .filter(
                models.ReviewLog.user_id == current_user.id,
                models.ReviewLog.vocab_id.in_(vocab_ids),
            )
            .delete(synchronize_session=False)
        )
        (
            db.query(models.Vocabulary)
            .filter(
                models.Vocabulary.user_id == current_user.id,
                models.Vocabulary.notebook_id == notebook_id,
            )
            .delete(synchronize_session=False)
        )

    db.delete(notebook)
    db.commit()
    return None


# ======= 单个词汇项管理 =======
# 注意：必须放在 /notebooks 路由之后

@router.get("/{vocab_id}", response_model=schemas.VocabularyRead)
def get_vocabulary_item(
    vocab_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    vocab = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.id == vocab_id,
            models.Vocabulary.user_id == current_user.id,
        )
        .first()
    )
    if not vocab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found")
    return vocab


@router.delete("/{vocab_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vocabulary_item(
    vocab_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    vocab = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.id == vocab_id,
            models.Vocabulary.user_id == current_user.id,
        )
        .first()
    )
    if not vocab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary not found")

    (
        db.query(models.ReviewLog)
        .filter(
            models.ReviewLog.user_id == current_user.id,
            models.ReviewLog.vocab_id == vocab_id,
        )
        .delete(synchronize_session=False)
    )
    db.delete(vocab)
    db.commit()
    return None


# ======= 复习相关 =======

@router.get("/notebooks/{notebook_id}/review")
def get_review_words(
    notebook_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取需要复习的单词（基于遗忘曲线）"""
    from datetime import datetime, date

    # 验证笔记本归属
    notebook = (
        db.query(models.VocabularyNotebook)
        .filter(
            models.VocabularyNotebook.id == notebook_id,
            models.VocabularyNotebook.user_id == current_user.id,
        )
        .first()
    )
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    today = date.today()

    # 优先获取需要复习的单词（新单词 + 到达复习时间的单词）
    words = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.user_id == current_user.id,
            models.Vocabulary.notebook_id == notebook_id,
        )
        .filter(
            # 新单词或到达复习时间的
            (models.Vocabulary.next_review_at == None) |  # 新单词
            (models.Vocabulary.next_review_at <= today)  # 到达复习时间
        )
        .order_by(
            # 优先复习旧单词和错误次数多的
            models.Vocabulary.lapse_count.desc(),
            models.Vocabulary.added_at.asc()
        )
        .limit(limit)
        .all()
    )

    return words


@router.post("/{vocab_id}/review")
def submit_review(
    vocab_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """提交复习反馈，更新单词的复习状态（基于 SM-2 算法）"""
    from datetime import datetime, timedelta, date

    feedback = payload.get("feedback", "good")  # again, hard, good, easy

    vocab = (
        db.query(models.Vocabulary)
        .filter(
            models.Vocabulary.id == vocab_id,
            models.Vocabulary.user_id == current_user.id,
        )
        .first()
    )
    if not vocab:
        raise HTTPException(status_code=404, detail="Vocabulary not found")

    # 记录旧值用于日志
    previous_familiarity = vocab.familiarity_score
    previous_interval = vocab.interval_days

    # SM-2 算法参数
    # quality: 0=完全忘记, 5=完美记住
    quality_map = {
        "again": 1,   # 不认识
        "hard": 2,    # 困难
        "good": 4,    # 认识
        "easy": 5,    # 简单
    }
    quality = quality_map.get(feedback, 4)

    # 更新熟悉度分数 (0-100)
    vocab.familiarity_score = max(0, min(100, vocab.familiarity_score + (quality - 3) * 10))

    # 更新 ease_factor (最小 130)
    vocab.ease_factor = max(130, vocab.ease_factor + (50 - quality * 10))

    # 计算间隔天数
    if quality < 3:
        # 认识不清楚，重置间隔
        vocab.interval_days = 1
        vocab.lapse_count += 1
    else:
        # 根据质量增加间隔
        if vocab.interval_days == 1:
            vocab.interval_days = 1
        elif vocab.interval_days == 0:
            vocab.interval_days = 1
        else:
            vocab.interval_days = int(vocab.interval_days * vocab.ease_factor / 100)

        # easy 时额外增加间隔
        if feedback == "easy":
            vocab.interval_days = int(vocab.interval_days * 1.3)

    # 更新下次复习时间
    vocab.next_review_at = date.today() + timedelta(days=vocab.interval_days)
    vocab.last_review_at = datetime.utcnow()
    vocab.review_count += 1

    # 更新状态
    if vocab.review_count >= 3 and vocab.familiarity_score >= 60:
        vocab.status = "learning"
    if vocab.familiarity_score >= 90:
        vocab.status = "mastered"

    db.commit()

    # 记录复习日志
    review_log = models.ReviewLog(
        user_id=current_user.id,
        vocab_id=vocab_id,
        feedback=feedback,
        previous_familiarity=previous_familiarity,
        new_familiarity=vocab.familiarity_score,
        previous_interval=previous_interval,
        new_interval=vocab.interval_days,
    )
    db.add(review_log)
    db.commit()

    return {
        "id": vocab.id,
        "familiarity_score": vocab.familiarity_score,
        "interval_days": vocab.interval_days,
        "next_review_at": vocab.next_review_at,
    }
