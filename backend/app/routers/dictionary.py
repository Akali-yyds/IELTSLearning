from fastapi import APIRouter, HTTPException, Query

from ..services.dictionary import lookup_word

router = APIRouter(tags=["dictionary"])


@router.get("/dictionary")
def get_dictionary_entry(word: str = Query(..., min_length=1, max_length=128)):
    if not word.strip():
        raise HTTPException(status_code=400, detail="word is required")
    entry = lookup_word(word)
    return {
        "word": entry.word,
        "lemma": entry.lemma,
        "phonetic": entry.phonetic,
        "pronunciation_url": entry.pronunciation_url,
        "meanings": [
            {
                "part_of_speech": m.part_of_speech,
                "definitions": m.definitions,
                "examples": m.examples or [],
            }
            for m in entry.meanings
        ],
        "synonyms": entry.synonyms,
        "source": entry.source,
    }


@router.get("/pronunciation")
def get_pronunciation(word: str = Query(..., min_length=1, max_length=128)):
    if not word.strip():
        raise HTTPException(status_code=400, detail="word is required")
    entry = lookup_word(word)
    return {
        "word": entry.word,
        "pronunciation_url": entry.pronunciation_url,
        "phonetic": entry.phonetic,
        "source": entry.source,
    }

