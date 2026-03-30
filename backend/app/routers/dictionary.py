from fastapi import APIRouter, HTTPException, Query

from ..services.dictionary import lookup_word, lookup_word_smart

router = APIRouter(tags=["dictionary"])


@router.get("/dictionary/smart")
def get_dictionary_entry_smart(word: str = Query(..., min_length=1, max_length=128)):
    """
    智能查词：先词形还原，再依次尝试候选词
    返回原词、命中的词根、和查询结果
    """
    if not word.strip():
        raise HTTPException(status_code=400, detail="word is required")

    result = lookup_word_smart(word)
    if result["result"] is None:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Word not found",
                "raw_word": result["raw_word"],
                "normalized": result["normalized"],
                "candidates": "词形还原候选词列表",
            }
        )

    return result


@router.get("/dictionary")
def get_dictionary_entry(word: str = Query(..., min_length=1, max_length=128)):
    if not word.strip():
        raise HTTPException(status_code=400, detail="word is required")
    entry = lookup_word(word)
    if not entry:
        raise HTTPException(status_code=404, detail="Word not found")
    return {
        "word": entry.get("word"),
        "phonetic": entry.get("phonetic"),
        "chinese_translation": entry.get("chinese_translation"),
        "english_definition": entry.get("english_definition"),
        "meanings": entry.get("meanings") or [],
        "tags": entry.get("tags") or {},
        "collins": entry.get("collins"),
        "oxford": entry.get("oxford"),
        "source": entry.get("source", "ecdict"),
    }


@router.get("/pronunciation")
def get_pronunciation(word: str = Query(..., min_length=1, max_length=128)):
    if not word.strip():
        raise HTTPException(status_code=400, detail="word is required")
    entry = lookup_word(word)
    if not entry:
        raise HTTPException(status_code=404, detail="Word not found")
    return {
        "word": entry.get("word"),
        "pronunciation_url": None,
        "phonetic": entry.get("phonetic"),
        "source": entry.get("source", "ecdict"),
    }

