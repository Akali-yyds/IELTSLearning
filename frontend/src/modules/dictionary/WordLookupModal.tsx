import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient, resolveApiUrl } from "../../shared/apiClient";
import { VocabularyNotebook } from "../vocabulary/types";

function normalizeWord(raw: string) {
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "");
  return cleaned.toLowerCase();
}

interface WordPopupProps {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
  onAddWord: (word: string, notebookId?: number, wordData?: {
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
    meanings?: Array<{ partOfSpeech: string; definitions: Array<{ definition: string; example?: string }> }>;
    sentences?: Array<{ english: string; chinese: string }>;
    phrases?: Array<{ phrase: string; translation: string }>;
    synonyms?: string[];
  }) => void;
  notebooks: VocabularyNotebook[];
  selectedNotebookId?: number;
  onNotebookChange: (id: number | "") => void;
}

export const WordPopup = ({
  word,
  position,
  onClose,
  onAddWord,
  notebooks,
  selectedNotebookId,
  onNotebookChange,
}: WordPopupProps) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [computedStyle, setComputedStyle] = useState<React.CSSProperties>({
    left: position.x,
    top: position.y,
    visibility: "hidden",
    transform: "translateX(-50%)",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedNotebookId) {
      onNotebookChange(selectedNotebookId);
    }
  }, []);

  useEffect(() => {
    if (!popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = position.x - rect.width / 2;
    let top: number;

    const topBelow = position.y + 10;
    const topAbove = position.y - rect.height - 10;

    if (topBelow + rect.height <= vh - 8) {
      top = topBelow;
    } else if (topAbove >= 8) {
      top = topAbove;
    } else {
      top = Math.max(8, Math.min(vh - rect.height - 8, position.y - rect.height / 2));
      const rightLeft = position.x + 20;
      if (rightLeft + rect.width <= vw - 8) {
        left = rightLeft;
      } else {
        left = position.x - rect.width - 20;
      }
    }

    if (left < 8) left = 8;
    if (left + rect.width > vw - 8) left = vw - rect.width - 8;

    setComputedStyle({
      left,
      top,
      visibility: "visible",
      transform: "none",
    });
  }, [position, loading]);

  const [meaning, setMeaning] = useState<{
    word?: string;
    phonetic?: string;
    chinese_translation?: string;
    english_definition?: string;
    uk_phonetic?: string;
    us_phonetic?: string;
    uk_audio?: string;
    us_audio?: string;
    meanings: Array<{ partOfSpeech: string; definitions: Array<{ definition: string; example?: string }> }>;
    synonyms?: string[];
    sentences?: Array<{ english: string; chinese: string }>;
    phrases?: Array<{ phrase: string; translation: string }>;
    tags?: Record<string, boolean>;
    collins?: number;
    oxford?: boolean;
    bnc?: number;
    frq?: number;
    source?: string;
    base_form?: {
      word: string;
      uk_phonetic?: string;
      us_phonetic?: string;
      uk_audio?: string;
      us_audio?: string;
      chinese_translation?: string;
      sentences?: Array<{ english: string; chinese: string }>;
      phrases?: Array<{ phrase: string; translation: string }>;
      synonyms?: string[];
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<number | "">("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [examplesLoading, setExamplesLoading] = useState(false);

  useEffect(() => {
    if (selectedNotebookId) {
      setSelectedNotebook(selectedNotebookId);
    }
  }, [selectedNotebookId]);

  useEffect(() => {
    let cancelled = false;

    const fetchMeaning = async () => {
      setLoading(true);
      setError(null);
      setAudioLoading(false);
      setExamplesLoading(false);
      try {
        const res = await apiClient.get<{
          word?: string;
          phonetic?: string;
          chinese_translation?: string;
          english_definition?: string;
          uk_phonetic?: string;
          us_phonetic?: string;
          uk_audio?: string;
          us_audio?: string;
          meanings: Array<{ partOfSpeech: string; definitions: Array<{ definition: string; example?: string }> }>;
          synonyms?: string[];
          sentences?: Array<{ english: string; chinese: string }>;
          phrases?: Array<{ phrase: string; translation: string }>;
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
            sentences?: Array<{ english: string; chinese: string }>;
            phrases?: Array<{ phrase: string; translation: string }>;
            synonyms?: string[];
          };
        }>(`/vocabulary/lookup?word=${encodeURIComponent(word)}`);
        if (cancelled) return;

        setMeaning(res.data);
        if (!cancelled) {
          setLoading(false);
        }

        const lookupWord = res.data.word || word;
        const lookupLemma = res.data.matched_word || lookupWord;

        setAudioLoading(true);
        setExamplesLoading(true);
        await Promise.allSettled([
          (async () => {
            try {
              const pronunciationRes = await apiClient.get<{
                phonetic?: string;
                uk_phonetic?: string;
                us_phonetic?: string;
                uk_audio?: string;
                us_audio?: string;
              }>("/vocabulary/lookup/pronunciation", {
                params: {
                  word,
                  lemma: lookupLemma,
                },
              });
              if (cancelled) return;
              setMeaning((prev) => (
                prev
                  ? {
                      ...prev,
                      phonetic: pronunciationRes.data.phonetic || prev.phonetic,
                      uk_phonetic: pronunciationRes.data.uk_phonetic || prev.uk_phonetic,
                      us_phonetic: pronunciationRes.data.us_phonetic || prev.us_phonetic,
                      uk_audio: pronunciationRes.data.uk_audio || prev.uk_audio,
                      us_audio: pronunciationRes.data.us_audio || prev.us_audio,
                    }
                  : prev
              ));
            } catch (audioErr) {
              console.error(audioErr);
            } finally {
              if (!cancelled) {
                setAudioLoading(false);
              }
            }
          })(),
          (async () => {
            try {
              const examplesRes = await apiClient.get<{
                sentences?: Array<{ english: string; chinese: string }>;
              }>("/vocabulary/lookup/examples", {
                params: {
                  word: lookupWord,
                  lemma: lookupLemma,
                },
              });
              if (cancelled) return;
              setMeaning((prev) => (
                prev
                  ? {
                      ...prev,
                      sentences: examplesRes.data.sentences || prev.sentences,
                    }
                  : prev
              ));
            } catch (examplesErr) {
              console.error(examplesErr);
            } finally {
              if (!cancelled) {
                setExamplesLoading(false);
              }
            }
          })(),
        ]);
      } catch (err) {
        console.error(err);
        if (cancelled) {
          return;
        }
        setError("无法获取释义");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
    audio.play();
  };

  const renderPhoneticItem = (
    label: string,
    phonetic?: string,
    audioUrl?: string
  ) => {
    if (!phonetic) return null;

    return (
      <div className="phonetic-item">
        <span className="phonetic-label">{label}</span>
        <span className="phonetic-text">{phonetic}</span>
        <button
          type="button"
          className="phonetic-play-btn"
          onClick={() => audioUrl && playAudio(audioUrl)}
          disabled={!audioUrl || audioPlaying || audioLoading}
          data-loading={audioLoading ? "true" : "false"}
          title={
            audioLoading
              ? `${label}式发音加载中`
              : audioUrl
                ? `播放${label}式发音`
                : `${label}式发音暂不可用`
          }
          aria-label={
            audioLoading
              ? `${label}式发音加载中`
              : audioUrl
                ? `播放${label}式发音`
                : `${label}式发音暂不可用`
          }
        >
          {audioLoading && <span className="phonetic-play-spinner" aria-hidden="true" />}
          <span className="phonetic-audio">{audioLoading ? "…" : "▶"}</span>
        </button>
      </div>
    );
  };

  const handleAddWord = () => {
    const wordData = meaning ? {
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
    } : undefined;
    onAddWord(word, selectedNotebook === "" ? undefined : selectedNotebook, wordData);
  };

  return (
    <div
      ref={popupRef}
      className="word-popup"
      style={computedStyle}
    >
      <div className="word-popup-header">
        <div className="word-popup-header-left">
          <span className="word-popup-word">{meaning?.word || word}</span>
          {meaning && (
            <div className="word-popup-badges">
              {meaning.tags?.ielts && <span className="word-badge badge-ielts">IELTS</span>}
              {meaning.tags?.toefl && <span className="word-badge badge-toefl">TOEFL</span>}
              {meaning.tags?.gre   && <span className="word-badge badge-gre">GRE</span>}
              {meaning.oxford && <span className="word-badge badge-oxford">Oxford</span>}
              {(meaning.collins ?? 0) > 0 && (
                <span className="word-badge badge-collins" title={`柯林斯 ${meaning.collins} 星`}>
                  {'★'.repeat(meaning.collins ?? 0)}{'☆'.repeat(5 - (meaning.collins ?? 0))}
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
            {/* 音标和发音 */}
            <div className="word-popup-phonetic-row">
              {(meaning.uk_phonetic || meaning.us_phonetic || meaning.phonetic) && (
                <div className="word-popup-phonetics">
                  {renderPhoneticItem("英", meaning.uk_phonetic || meaning.phonetic, meaning.uk_audio)}
                  {renderPhoneticItem("美", meaning.us_phonetic || meaning.phonetic, meaning.us_audio)}
                </div>
              )}
            </div>

            {/* 中文释义 */}
            {meaning.chinese_translation && (
              <div className="word-popup-chinese">{meaning.chinese_translation}</div>
            )}

            {/* 词义列表 */}
            <div className="word-popup-meanings">
              {meaning.meanings.map((m, i) => (
                <div key={i} className="word-popup-meaning">
                  <div className="word-popup-pos">{m.partOfSpeech}</div>
                  {m.definitions.slice(0, 2).map((d, j) => (
                    <div key={j} className="word-popup-def">
                      {j + 1}. {d.definition}
                      {d.example && <div className="word-popup-ex">"{d.example}"</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* 短语 */}
            {meaning.phrases && meaning.phrases.length > 0 && (
              <div className="word-popup-section">
                <div className="word-popup-section-title">短语</div>
                {meaning.phrases.slice(0, 3).map((p, i) => (
                  <div key={i} className="word-popup-phrase">
                    <span className="phrase-content">{p.phrase}</span>
                    <span className="phrase-translation">{p.translation}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 双语例句 */}
            {(examplesLoading || (meaning.sentences && meaning.sentences.length > 0)) && (
              <div className="word-popup-section">
                <div className="word-popup-section-title">例句</div>
                {meaning.sentences && meaning.sentences.length > 0 ? (
                  meaning.sentences.slice(0, 2).map((s, i) => (
                    <div key={i} className="word-popup-sentence">
                      <div className="sentence-english">{s.english}</div>
                      <div className="sentence-chinese">{s.chinese}</div>
                    </div>
                  ))
                ) : (
                  <div className="word-popup-section-loading">例句加载中...</div>
                )}
              </div>
            )}

            {/* 同义词 */}
            {meaning.synonyms && meaning.synonyms.length > 0 && (
              <div className="word-popup-section">
                <div className="word-popup-section-title">同义词</div>
                <div className="word-popup-synonyms">
                  {meaning.synonyms.slice(0, 5).map((syn, i) => (
                    <span key={i} className="synonym-tag">{syn}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 原型词根（来自 xxapi，仅变形词时出现）*/}
            {meaning.base_form && (
              <div className="word-popup-section word-popup-base-form">
                <div className="word-popup-section-title">原型</div>
                <div className="word-popup-base-word-row">
                  <span className="word-popup-base-word">{meaning.base_form.word}</span>
                  <div className="word-popup-phonetics">
                    {renderPhoneticItem("英", meaning.base_form.uk_phonetic, meaning.base_form.uk_audio)}
                    {renderPhoneticItem("美", meaning.base_form.us_phonetic, meaning.base_form.us_audio)}
                  </div>
                </div>
                {meaning.base_form.chinese_translation && (
                  <div className="word-popup-chinese">{meaning.base_form.chinese_translation}</div>
                )}
                {meaning.base_form.phrases && meaning.base_form.phrases.length > 0 && (
                  <div className="word-popup-section" style={{ marginTop: 6, paddingTop: 6 }}>
                    <div className="word-popup-section-title">短语</div>
                    {meaning.base_form.phrases.slice(0, 3).map((p, i) => (
                      <div key={i} className="word-popup-phrase">
                        <span className="phrase-content">{p.phrase}</span>
                        <span className="phrase-translation">{p.translation}</span>
                      </div>
                    ))}
                  </div>
                )}
                {meaning.base_form.sentences && meaning.base_form.sentences.length > 0 && (
                  <div className="word-popup-section" style={{ marginTop: 6, paddingTop: 6 }}>
                    <div className="word-popup-section-title">例句</div>
                    {meaning.base_form.sentences.slice(0, 2).map((s, i) => (
                      <div key={i} className="word-popup-sentence">
                        <div className="sentence-english">{s.english}</div>
                        <div className="sentence-chinese">{s.chinese}</div>
                      </div>
                    ))}
                  </div>
                )}
                {meaning.base_form.synonyms && meaning.base_form.synonyms.length > 0 && (
                  <div className="word-popup-section" style={{ marginTop: 6, paddingTop: 6 }}>
                    <div className="word-popup-section-title">同义词</div>
                    <div className="word-popup-synonyms">
                      {meaning.base_form.synonyms.slice(0, 5).map((syn, i) => (
                        <span key={i} className="synonym-tag">{syn}</span>
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
              value={selectedNotebook}
              onChange={(e) => onNotebookChange(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">选择生词本</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.name}
                </option>
              ))}
            </select>
            <button className="primary-btn" onClick={handleAddWord} disabled={!selectedNotebook}>
              + 添加到生词本
            </button>
          </>
        ) : (
          <div className="word-popup-no-notebook">
            暂无生词本，请先创建生词本
          </div>
        )}
      </div>
    </div>
  );
};

export const WordLookupModal = (props: {
  open: boolean;
  rawWord: string;
  sourceArticleId?: number;
  onClose: () => void;
}) => {
  const normalized = useMemo(() => normalizeWord(props.rawWord), [props.rawWord]);
  const [wordPopupPosition, setWordPopupPosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [showWordPopup, setShowWordPopup] = useState(false);
  const [notebooks, setNotebooks] = useState<VocabularyNotebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<number | "">("");

  useEffect(() => {
    if (!props.open) {
      setShowWordPopup(false);
      return;
    }

    const loadNotebooks = async () => {
      try {
        const res = await apiClient.get<VocabularyNotebook[]>("/vocabulary/notebooks");
        setNotebooks(res.data);
        const lastNotebookId = localStorage.getItem("lastNotebookId");
        if (lastNotebookId) {
          const exists = res.data.find((nb) => nb.id === parseInt(lastNotebookId));
          if (exists) {
            setSelectedNotebook(parseInt(lastNotebookId));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadNotebooks();

    if (normalized) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setWordPopupPosition({ x: vw / 2, y: vh / 2 });
      setShowWordPopup(true);
    }
  }, [props.open, normalized]);

  const handleAddWord = async (
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
      meanings?: Array<{ partOfSpeech: string; definitions: Array<{ definition: string; example?: string }> }>;
      sentences?: Array<{ english: string; chinese: string }>;
      phrases?: Array<{ phrase: string; translation: string }>;
      synonyms?: string[];
    }
  ) => {
    try {
      if (!notebookId) {
        alert("请选择要添加到的生词本");
        return;
      }

      const meaningsJson = JSON.stringify({
        meanings: wordData?.meanings || [],
        sentences: wordData?.sentences || [],
        phrases: wordData?.phrases || [],
        synonyms: wordData?.synonyms || [],
      });

      const tagsStr = wordData?.tags
        ? Object.entries(wordData.tags).filter(([, v]) => v).map(([k]) => k).join(" ")
        : undefined;

      await apiClient.post("/vocabulary", {
        word: word,
        lemma: word.toLowerCase(),
        notebook_id: notebookId,
        phonetic: wordData?.phonetic,
        chinese_translation: wordData?.chinese_translation,
        english_definition: wordData?.english_definition,
        uk_phonetic: wordData?.uk_phonetic,
        us_phonetic: wordData?.us_phonetic,
        uk_audio: wordData?.uk_audio,
        us_audio: wordData?.us_audio,
        tags: tagsStr,
        collins: wordData?.collins,
        oxford: wordData?.oxford,
        bnc: wordData?.bnc,
        frq: wordData?.frq,
        meanings_json: meaningsJson,
        pronunciation_url: wordData?.uk_audio || wordData?.us_audio,
        source_article_id: props.sourceArticleId ?? null,
      });
      setShowWordPopup(false);
      localStorage.setItem("lastNotebookId", String(notebookId));
      props.onClose();
    } catch (err) {
      console.error(err);
      alert("添加生词失败");
    }
  };

  if (!props.open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={props.onClose}>
      {showWordPopup && (
        <WordPopup
          word={normalized || props.rawWord}
          position={wordPopupPosition}
          onClose={props.onClose}
          onAddWord={handleAddWord}
          notebooks={notebooks}
          selectedNotebookId={selectedNotebook === "" ? undefined : selectedNotebook}
          onNotebookChange={setSelectedNotebook}
        />
      )}
    </div>
  );
};
