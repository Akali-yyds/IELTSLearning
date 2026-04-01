import shutil
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Optional

import nltk

from ..config import settings
from .lemmatizer import clean_word

try:
    nltk.data.find("corpora/cmudict")
except LookupError:
    nltk.download("cmudict", quiet=True)

from nltk.corpus import cmudict

from .tts import get_audio_urls

_CMU_DICT = cmudict.dict()

ARPABET_TO_IPA = {
    "AA": "ɑ",
    "AE": "æ",
    "AO": "ɔ",
    "AW": "aʊ",
    "AY": "aɪ",
    "B": "b",
    "CH": "tʃ",
    "D": "d",
    "DH": "ð",
    "EH": "ɛ",
    "EY": "eɪ",
    "F": "f",
    "G": "g",
    "HH": "h",
    "IH": "ɪ",
    "IY": "i",
    "JH": "dʒ",
    "K": "k",
    "L": "l",
    "M": "m",
    "N": "n",
    "NG": "ŋ",
    "OW": "oʊ",
    "OY": "ɔɪ",
    "P": "p",
    "R": "ɹ",
    "S": "s",
    "SH": "ʃ",
    "T": "t",
    "TH": "θ",
    "UH": "ʊ",
    "UW": "u",
    "V": "v",
    "W": "w",
    "Y": "j",
    "Z": "z",
    "ZH": "ʒ",
}


def _resolve_executable(command: str) -> Optional[str]:
    if not command:
        return None
    if Path(command).exists():
        return str(Path(command))
    return shutil.which(command)


def _normalize_ipa_text(text: str) -> str:
    cleaned = text.strip()
    cleaned = cleaned.replace(" ", "")
    cleaned = cleaned.replace("_", "")
    cleaned = cleaned.replace("\n", "")
    cleaned = cleaned.replace("ˌˈ", "ˈ")
    return cleaned.strip()


def _arpabet_to_ipa(phones: list[str]) -> str:
    ipa_parts: list[str] = []
    for phone in phones:
        stress = ""
        base = phone
        stress_digit = ""
        if phone and phone[-1].isdigit():
            stress_digit = phone[-1]
            stress = "ˈ" if stress_digit == "1" else "ˌ" if stress_digit == "2" else ""
            base = phone[:-1]

        if base == "AH":
            ipa = "ə" if stress_digit == "0" else "ʌ"
        elif base == "ER":
            ipa = "ɚ" if stress_digit == "0" else "ɝ"
        else:
            ipa = ARPABET_TO_IPA.get(base)
        if not ipa:
            continue
        if stress:
            ipa_parts.append(stress)
        ipa_parts.append(ipa)

    return "".join(ipa_parts)


def _lookup_cmudict(word: str) -> Optional[str]:
    pronunciations = _CMU_DICT.get(word.lower())
    if not pronunciations:
        return None
    ipa = _arpabet_to_ipa(pronunciations[0])
    return f"/{ipa}/" if ipa else None


def _get_espeak_ipa(word: str, voice: str) -> Optional[str]:
    executable = _resolve_executable(settings.espeak_path)
    if not executable:
        return None

    cmd = [executable, "-q", "--ipa", "-v", voice, word]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            check=True,
            timeout=10,
            encoding="utf-8",
        )
    except (OSError, subprocess.SubprocessError):
        return None

    ipa = _normalize_ipa_text(result.stdout)
    return f"/{ipa}/" if ipa else None


@lru_cache(maxsize=4096)
def get_pronunciation_data(word: str, lemma: str = "", include_audio: bool = False) -> dict:
    candidates = []
    for candidate in (clean_word(word), clean_word(lemma)):
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    if not candidates:
        return {
            "phonetic": None,
            "uk_phonetic": None,
            "us_phonetic": None,
            "uk_audio": None,
            "us_audio": None,
        }

    matched = candidates[0]
    cmu_ipa = None
    for candidate in candidates:
        cmu_ipa = _lookup_cmudict(candidate)
        if cmu_ipa:
            matched = candidate
            break

    us_phonetic = _get_espeak_ipa(matched, "en-us") or cmu_ipa
    uk_phonetic = _get_espeak_ipa(matched, "en-gb") or us_phonetic or cmu_ipa
    phonetic = uk_phonetic or us_phonetic or cmu_ipa
    audio_urls = get_audio_urls(matched) if include_audio else {"uk_audio": None, "us_audio": None}

    return {
        "phonetic": phonetic,
        "uk_phonetic": uk_phonetic,
        "us_phonetic": us_phonetic,
        "uk_audio": audio_urls["uk_audio"],
        "us_audio": audio_urls["us_audio"],
    }
