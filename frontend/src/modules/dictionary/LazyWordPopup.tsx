import axios from "axios";
import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiClient, resolveApiUrl } from "../../shared/apiClient";
import { VocabularyNotebook } from "../vocabulary/types";

type MeaningDefinition = { definition: string; example?: string };
type MeaningItem = { partOfSpeech: string; definitions: MeaningDefinition[] };
type SentenceItem = { english: string; chinese: string };
type PhraseItem = { phrase: string; translation: string };
type PronunciationTarget = "current" | "base";
type PronunciationVariant = "uk" | "us";

interface WordPopupData {
  word?: string;
  phonetic?: string;
  chinese_translation?: string;
  english_definition?: string;
  uk_phonetic?: string;
  us_phonetic?: string;
  uk_audio?: string;
  us_audio?: string;
  meanings: MeaningItem[];
  synonyms?: string[];
  sentences?: SentenceItem[];
  phrases?: PhraseItem[];
  tags?: Record<string, boolean>;
  collins?: number;
  oxford?: boolean;
  bnc?: number;
  frq?: number;
  source?: string;
  matched_word?: string;
  raw_word?: string;
  base_form?: {
    word: string;
    uk_phonetic?: string;
    us_phonetic?: string;
    uk_audio?: string;
    us_audio?: string;
    chinese_translation?: string;
    sentences?: SentenceItem[];
    phrases?: PhraseItem[];
    synonyms?: string[];
  };
}

interface LazyWordPopupProps {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
  onAddWord: (
    word: string,
    notebookId?: number,
    wordData?: {
      phonetic?: string;
      chinese_translation?: string;
      english_definition?: string;
      uk_phonetic?: string;
      us_phonetic?: string;
      uk_audio?: string;
      us_audio?: string;
      tags?: Record<string, boolean>;
      collins?: number;
      oxford?: boolean;
      bnc?: number;
      frq?: number;
      meanings?: MeaningItem[];
      sentences?: SentenceItem[];
      phrases?: PhraseItem[];
      synonyms?: string[];
    }
  ) => Promise<void> | void;
  notebooks: VocabularyNotebook[];
  selectedNotebookId?: number;
  onNotebookChange: (id: number | "") => void;
}

export const LazyWordPopup = ({
  word,
  position,
  onClose,
  onAddWord,
  notebooks,
  selectedNotebookId,
  onNotebookChange,
}: LazyWordPopupProps) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [computedStyle, setComputedStyle] = useState<CSSProperties>({
    left: position.x,
    top: position.y,
    visibility: "hidden",
    transform: "translateX(-50%)",
  });
  const [loading, setLoading] = useState(true);
  const [meaning, setMeaning] = useState<WordPopupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoadingKey, setAudioLoadingKey] = useState<string | null>(null);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [addingWord, setAddingWord] = useState(false);

  useLayoutEffect(() => {
    if (!popupRef.current) return;

    const positionPopup = () => {
      if (!popupRef.current) return;

      const rect = popupRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxHeight = Math.min(viewportHeight - 16, 580);
      const effectiveHeight = Math.min(rect.height, maxHeight);

      let left = position.x - rect.width / 2;
      let top: number;

      const belowTop = position.y + 10;
      const aboveTop = position.y - effectiveHeight - 10;

      if (belowTop + effectiveHeight <= viewportHeight - 8) {
        top = belowTop;
      } else if (aboveTop >= 8) {
        top = aboveTop;
      } else {
        top = Math.max(8, Math.min(viewportHeight - effectiveHeight - 8, position.y - effectiveHeight / 2));
        const rightSideLeft = position.x + 20;
        if (rightSideLeft + rect.width <= viewportWidth - 8) {
          left = rightSideLeft;
        } else {
          left = position.x - rect.width - 20;
        }
      }

      if (left < 8) left = 8;
      if (left + rect.width > viewportWidth - 8) left = viewportWidth - rect.width - 8;

      setComputedStyle({
        left,
        top,
        maxHeight,
        visibility: "visible",
        transform: "none",
      });
    };

    positionPopup();
    window.addEventListener("resize", positionPopup);
    return () => window.removeEventListener("resize", positionPopup);
  }, [position, loading, audioLoadingKey, examplesLoading, meaning, addingWord]);

  useEffect(() => {
    let cancelled = false;

    const fetchMeaning = async () => {
      setLoading(true);
      setError(null);
      setMeaning(null);
      setAudioLoadingKey(null);
      setExamplesLoading(false);

      try {
        const res = await apiClient.get<WordPopupData>(`/vocabulary/lookup?word=${encodeURIComponent(word)}`);
        if (cancelled) return;

        setMeaning(res.data);
        setLoading(false);

        const lookupWord = res.data.word || word;
        const lookupLemma = res.data.matched_word || lookupWord;

        setExamplesLoading(true);
        try {
          const examplesRes = await apiClient.get<{ sentences?: SentenceItem[] }>("/vocabulary/lookup/examples", {
            params: { word: lookupWord, lemma: lookupLemma },
          });
          if (cancelled) return;
          setMeaning((prev) => (prev ? { ...prev, sentences: examplesRes.data.sentences || prev.sentences } : prev));
        } catch (examplesErr) {
          console.error(examplesErr);
        } finally {
          if (!cancelled) {
            setExamplesLoading(false);
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setError("未找到该单词的释义");
        } else {
          console.error(err);
          setError("无法获取释义");
        }
        setLoading(false);
      }
    };

    if (word.trim()) {
      fetchMeaning();
    }

    return () => {
      cancelled = true;
    };
  }, [word]);

  const playAudio = (audioUrl: string) => {
    if (audioPlaying) return;
    setAudioPlaying(true);
    const audio = new Audio(resolveApiUrl(audioUrl));
    audio.onended = () => setAudioPlaying(false);
    audio.onerror = () => setAudioPlaying(false);
    void audio.play().catch((err) => {
      console.error(err);
      setAudioPlaying(false);
    });
  };

  const loadPronunciationAudio = async (target: PronunciationTarget, variant: PronunciationVariant) => {
    if (!meaning || audioLoadingKey) return;

    const key = `${target}:${variant}`;
    const targetWord = target === "base" ? meaning.base_form?.word : (meaning.word || word);
    const targetLemma = target === "base"
      ? meaning.base_form?.word
      : (meaning.matched_word || meaning.word || word);
    const existingAudioUrl = target === "base"
      ? (variant === "uk" ? meaning.base_form?.uk_audio : meaning.base_form?.us_audio)
      : (variant === "uk" ? meaning.uk_audio : meaning.us_audio);

    if (existingAudioUrl) {
      playAudio(existingAudioUrl);
      return;
    }

    if (!targetWord) return;

    setAudioLoadingKey(key);
    try {
      const pronunciationRes = await apiClient.get<{
        phonetic?: string;
        uk_phonetic?: string;
        us_phonetic?: string;
        uk_audio?: string;
        us_audio?: string;
      }>("/vocabulary/lookup/pronunciation", {
        params: { word: targetWord, lemma: targetLemma },
      });

      const nextAudioUrl = variant === "uk" ? pronunciationRes.data.uk_audio : pronunciationRes.data.us_audio;

      setMeaning((prev) => {
        if (!prev) return prev;

        if (target === "base" && prev.base_form) {
          return {
            ...prev,
            base_form: {
              ...prev.base_form,
              uk_phonetic: pronunciationRes.data.uk_phonetic || prev.base_form.uk_phonetic,
              us_phonetic: pronunciationRes.data.us_phonetic || prev.base_form.us_phonetic,
              uk_audio: pronunciationRes.data.uk_audio || prev.base_form.uk_audio,
              us_audio: pronunciationRes.data.us_audio || prev.base_form.us_audio,
            },
          };
        }

        return {
          ...prev,
          phonetic: pronunciationRes.data.phonetic || prev.phonetic,
          uk_phonetic: pronunciationRes.data.uk_phonetic || prev.uk_phonetic,
          us_phonetic: pronunciationRes.data.us_phonetic || prev.us_phonetic,
          uk_audio: pronunciationRes.data.uk_audio || prev.uk_audio,
          us_audio: pronunciationRes.data.us_audio || prev.us_audio,
        };
      });

      if (nextAudioUrl) {
        playAudio(nextAudioUrl);
      }
    } catch (audioErr) {
      console.error(audioErr);
    } finally {
      setAudioLoadingKey((current) => (current === key ? null : current));
    }
  };

  const renderPhoneticItem = (
    label: string,
    phonetic?: string,
    audioUrl?: string,
    target: PronunciationTarget = "current",
  ) => {
    const variant: PronunciationVariant = label === "英" ? "uk" : "us";
    const loadingThisAudio = audioLoadingKey === `${target}:${variant}`;
    if (!phonetic) return null;

    const actionTitle = loadingThisAudio
      ? `${label}式发音加载中`
      : audioUrl
        ? `播放${label}式发音`
        : `点击获取${label}式发音`;

    return (
      <div className="phonetic-item">
        <span className="phonetic-label">{label}</span>
        <span className="phonetic-text">{phonetic}</span>
        <button
          type="button"
          className="phonetic-play-btn"
          onClick={() => loadPronunciationAudio(target, variant)}
          disabled={audioPlaying || !!audioLoadingKey}
          data-loading={loadingThisAudio ? "true" : "false"}
          title={actionTitle}
          aria-label={actionTitle}
        >
          {loadingThisAudio && <span className="phonetic-play-spinner" aria-hidden="true" />}
          <span className="phonetic-audio">{loadingThisAudio ? "..." : "▶"}</span>
        </button>
      </div>
    );
  };

  const handleAddWord = async () => {
    if (addingWord) return;

    const wordData = meaning
      ? {
          phonetic: meaning.phonetic,
          chinese_translation: meaning.chinese_translation,
          english_definition: meaning.english_definition,
          uk_phonetic: meaning.uk_phonetic,
          us_phonetic: meaning.us_phonetic,
          uk_audio: meaning.uk_audio,
          us_audio: meaning.us_audio,
          tags: meaning.tags,
          collins: meaning.collins,
          oxford: meaning.oxford,
          bnc: meaning.bnc,
          frq: meaning.frq,
          meanings: meaning.meanings,
          sentences: meaning.sentences,
          phrases: meaning.phrases,
          synonyms: meaning.synonyms,
        }
      : undefined;

    setAddingWord(true);
    try {
      await Promise.resolve(onAddWord(word, selectedNotebookId, wordData));
    } finally {
      setAddingWord(false);
    }
  };

  const collinsLevel = meaning?.collins ?? 0;

  return (
    <div ref={popupRef} className="word-popup" style={computedStyle}>
      <div className="word-popup-header">
        <div className="word-popup-header-left">
          <span className="word-popup-word">{meaning?.word || word}</span>
          {meaning && (
            <div className="word-popup-badges">
              {meaning.tags?.ielts && <span className="word-badge badge-ielts">IELTS</span>}
              {meaning.tags?.toefl && <span className="word-badge badge-toefl">TOEFL</span>}
              {meaning.tags?.gre && <span className="word-badge badge-gre">GRE</span>}
              {meaning.oxford && <span className="word-badge badge-oxford">Oxford</span>}
              {collinsLevel > 0 && (
                <span className="word-badge badge-collins" title={`柯林斯 ${collinsLevel} 星`}>
                  {"★".repeat(collinsLevel)}
                  {"☆".repeat(5 - collinsLevel)}
                </span>
              )}
            </div>
          )}
        </div>
        <button className="word-popup-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="word-popup-body">
        {loading && <div className="word-popup-loading">加载中...</div>}
        {error && <div className="word-popup-error">{error}</div>}
        {meaning && (
          <>
            <div className="word-popup-phonetic-row">
              {(meaning.uk_phonetic || meaning.us_phonetic || meaning.phonetic) && (
                <div className="word-popup-phonetics">
                  {renderPhoneticItem("英", meaning.uk_phonetic || meaning.phonetic, meaning.uk_audio, "current")}
                  {renderPhoneticItem("美", meaning.us_phonetic || meaning.phonetic, meaning.us_audio, "current")}
                </div>
              )}
            </div>

            {meaning.chinese_translation && (
              <div className="word-popup-chinese">{meaning.chinese_translation}</div>
            )}

            <div className="word-popup-meanings">
              {meaning.meanings.map((item, index) => (
                <div key={index} className="word-popup-meaning">
                  <div className="word-popup-pos">{item.partOfSpeech}</div>
                  {item.definitions.slice(0, 2).map((definition, definitionIndex) => (
                    <div key={definitionIndex} className="word-popup-def">
                      {definitionIndex + 1}. {definition.definition}
                      {definition.example && <div className="word-popup-ex">"{definition.example}"</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {meaning.phrases && meaning.phrases.length > 0 && (
              <div className="word-popup-section">
                <div className="word-popup-section-title">短语</div>
                {meaning.phrases.slice(0, 3).map((phrase, index) => (
                  <div key={index} className="word-popup-phrase">
                    <span className="phrase-content">{phrase.phrase}</span>
                    <span className="phrase-translation">{phrase.translation}</span>
                  </div>
                ))}
              </div>
            )}

            {(examplesLoading || (meaning.sentences && meaning.sentences.length > 0)) && (
              <div className="word-popup-section">
                <div className="word-popup-section-title">例句</div>
                {meaning.sentences && meaning.sentences.length > 0 ? (
                  meaning.sentences.slice(0, 2).map((sentence, index) => (
                    <div key={index} className="word-popup-sentence">
                      <div className="sentence-english">{sentence.english}</div>
                      <div className="sentence-chinese">{sentence.chinese}</div>
                    </div>
                  ))
                ) : (
                  <div className="word-popup-section-loading">例句加载中...</div>
                )}
              </div>
            )}

            {meaning.synonyms && meaning.synonyms.length > 0 && (
              <div className="word-popup-section">
                <div className="word-popup-section-title">同义词</div>
                <div className="word-popup-synonyms">
                  {meaning.synonyms.slice(0, 5).map((synonym, index) => (
                    <span key={index} className="synonym-tag">{synonym}</span>
                  ))}
                </div>
              </div>
            )}

            {meaning.base_form && (
              <div className="word-popup-section word-popup-base-form">
                <div className="word-popup-section-title">原型</div>
                <div className="word-popup-base-word-row">
                  <span className="word-popup-base-word">{meaning.base_form.word}</span>
                  <div className="word-popup-phonetics">
                    {renderPhoneticItem("英", meaning.base_form.uk_phonetic, meaning.base_form.uk_audio, "base")}
                    {renderPhoneticItem("美", meaning.base_form.us_phonetic, meaning.base_form.us_audio, "base")}
                  </div>
                </div>
                {meaning.base_form.chinese_translation && (
                  <div className="word-popup-chinese">{meaning.base_form.chinese_translation}</div>
                )}
                {meaning.base_form.phrases && meaning.base_form.phrases.length > 0 && (
                  <div className="word-popup-section" style={{ marginTop: 6, paddingTop: 6 }}>
                    <div className="word-popup-section-title">短语</div>
                    {meaning.base_form.phrases.slice(0, 3).map((phrase, index) => (
                      <div key={index} className="word-popup-phrase">
                        <span className="phrase-content">{phrase.phrase}</span>
                        <span className="phrase-translation">{phrase.translation}</span>
                      </div>
                    ))}
                  </div>
                )}
                {meaning.base_form.sentences && meaning.base_form.sentences.length > 0 && (
                  <div className="word-popup-section" style={{ marginTop: 6, paddingTop: 6 }}>
                    <div className="word-popup-section-title">例句</div>
                    {meaning.base_form.sentences.slice(0, 2).map((sentence, index) => (
                      <div key={index} className="word-popup-sentence">
                        <div className="sentence-english">{sentence.english}</div>
                        <div className="sentence-chinese">{sentence.chinese}</div>
                      </div>
                    ))}
                  </div>
                )}
                {meaning.base_form.synonyms && meaning.base_form.synonyms.length > 0 && (
                  <div className="word-popup-section" style={{ marginTop: 6, paddingTop: 6 }}>
                    <div className="word-popup-section-title">同义词</div>
                    <div className="word-popup-synonyms">
                      {meaning.base_form.synonyms.slice(0, 5).map((synonym, index) => (
                        <span key={index} className="synonym-tag">{synonym}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="word-popup-add-section">
        {notebooks.length > 0 ? (
          <>
            <select
              className="word-popup-notebook-select"
              value={selectedNotebookId ?? ""}
              onChange={(e) => onNotebookChange(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={addingWord}
            >
              <option value="">选择生词本</option>
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </option>
              ))}
            </select>
            <button
              className="primary-btn word-popup-add-btn"
              onClick={handleAddWord}
              disabled={!selectedNotebookId || addingWord}
            >
              <span className="word-popup-add-icon" aria-hidden="true">
                {addingWord ? <span className="word-popup-add-spinner" /> : "+"}
              </span>
              <span>{addingWord ? "添加中..." : "添加到生词本"}</span>
            </button>
          </>
        ) : (
          <div className="word-popup-no-notebook">暂无生词本，请先创建生词本</div>
        )}
      </div>
    </div>
  );
};
