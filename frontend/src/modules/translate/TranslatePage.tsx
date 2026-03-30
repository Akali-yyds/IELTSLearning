import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { VocabularyNotebook } from "../vocabulary/types";

// 单词释义弹窗组件
const WordPopup = ({
  word,
  position,
  onClose,
  onAddWord,
  notebooks,
  selectedNotebookId,
  onNotebookChange,
}: {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
  onAddWord: (word: string, notebookId?: number, wordData?: {
    phonetic?: string;
    chinese_translation?: string;
    uk_phonetic?: string;
    us_phonetic?: string;
    uk_audio?: string;
    us_audio?: string;
    meanings_json?: string;
  }) => void;
  notebooks: VocabularyNotebook[];
  selectedNotebookId?: number;
  onNotebookChange: (id: number | "") => void;
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [computedStyle, setComputedStyle] = useState<React.CSSProperties>({
    left: position.x,
    top: position.y,
    visibility: "hidden",
    transform: "translateX(-50%)",
  });

  useLayoutEffect(() => {
    if (!popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = position.x - rect.width / 2;
    let top = position.y + 10;

    if (top + rect.height > vh - 8) {
      top = position.y - rect.height - 10;
    }

    if (left < 8) left = 8;
    if (left + rect.width > vw - 8) left = vw - rect.width - 8;

    setComputedStyle({
      left,
      top,
      visibility: "visible",
      transform: "none",
    });
  }, [position]);

  const [meaning, setMeaning] = useState<{
    word?: string;
    phonetic?: string;
    chinese_translation?: string;
    uk_phonetic?: string;
    us_phonetic?: string;
    uk_audio?: string;
    us_audio?: string;
    meanings: Array<{ partOfSpeech: string; definitions: Array<{ definition: string; example?: string }> }>;
    synonyms?: string[];
    sentences?: Array<{ english: string; chinese: string }>;
    phrases?: Array<{ phrase: string; translation: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<number | "">("");
  const [audioPlaying, setAudioPlaying] = useState(false);

  // 初始化时使用外部传入的值
  useEffect(() => {
    if (selectedNotebookId) {
      setSelectedNotebook(selectedNotebookId);
    }
  }, [selectedNotebookId]);

  useEffect(() => {
    const fetchMeaning = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<{
          word?: string;
          phonetic?: string;
          chinese_translation?: string;
          uk_phonetic?: string;
          us_phonetic?: string;
          uk_audio?: string;
          us_audio?: string;
          meanings: Array<{ partOfSpeech: string; definitions: Array<{ definition: string; example?: string }> }>;
          synonyms?: string[];
          sentences?: Array<{ english: string; chinese: string }>;
          phrases?: Array<{ phrase: string; translation: string }>;
        }>(`/vocabulary/lookup?word=${encodeURIComponent(word)}`);
        setMeaning(res.data);
      } catch (err) {
        console.error(err);
        setError("无法获取释义");
      } finally {
        setLoading(false);
      }
    };

    if (word.trim()) {
      fetchMeaning();
    }
  }, [word]);

  const playAudio = (audioUrl: string) => {
    if (audioPlaying) return;
    setAudioPlaying(true);
    const audio = new Audio(audioUrl);
    audio.onended = () => setAudioPlaying(false);
    audio.onerror = () => setAudioPlaying(false);
    audio.play();
  };

  const handleAddWord = () => {
    // 构造完整的单词数据
    const wordData = meaning ? {
      phonetic: meaning.phonetic,
      chinese_translation: meaning.chinese_translation,
      uk_phonetic: meaning.uk_phonetic,
      us_phonetic: meaning.us_phonetic,
      uk_audio: meaning.uk_audio,
      us_audio: meaning.us_audio,
      meanings_json: JSON.stringify(meaning.meanings),
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
        <span className="word-popup-word">{meaning?.word || word}</span>
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
              {(meaning.uk_phonetic || meaning.us_phonetic) && (
                <div className="word-popup-phonetics">
                  {meaning.uk_phonetic && (
                    <span className="phonetic-item" onClick={() => meaning.uk_audio && playAudio(meaning.uk_audio)}>
                      <span className="phonetic-label">英</span>
                      <span className="phonetic-text">{meaning.uk_phonetic}</span>
                      {meaning.uk_audio && (
                        <span className="phonetic-audio">🔊</span>
                      )}
                    </span>
                  )}
                  {meaning.us_phonetic && (
                    <span className="phonetic-item" onClick={() => meaning.us_audio && playAudio(meaning.us_audio)}>
                      <span className="phonetic-label">美</span>
                      <span className="phonetic-text">{meaning.us_phonetic}</span>
                      {meaning.us_audio && (
                        <span className="phonetic-audio">🔊</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 中文释义 */}
            {meaning.chinese_translation && (
              <div className="word-popup-chinese">{meaning.chinese_translation}</div>
            )}

            {/* 英文释义 */}
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
            {meaning.sentences && meaning.sentences.length > 0 && (
              <div className="word-popup-section">
                <div className="word-popup-section-title">例句</div>
                {meaning.sentences.slice(0, 2).map((s, i) => (
                  <div key={i} className="word-popup-sentence">
                    <div className="sentence-english">{s.english}</div>
                    <div className="sentence-chinese">{s.chinese}</div>
                  </div>
                ))}
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

// 存为文章弹窗组件
const SaveArticleModal = ({
  onClose,
  onSave,
  initialTitle = "",
  initialNote = "",
}: {
  onClose: () => void;
  onSave: (title: string, note: string) => void;
  initialTitle?: string;
  initialNote?: string;
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      alert("请输入文章标题");
      return;
    }
    setSaving(true);
    await onSave(title.trim(), note.trim());
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="save-article-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">保存文章</h2>
            <p className="modal-subtitle">将翻译内容保存到我的空间</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <label className="save-article-label">
            文章标题
            <input
              type="text"
              className="title-input"
              placeholder="输入文章标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>
          <label className="save-article-label">
            备注（可选）
            <textarea
              className="title-input"
              placeholder="添加备注..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button className="primary-btn" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "确认保存"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const TranslatePage = () => {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [translateTimeoutRef, setTranslateTimeoutRef] = useState<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 单词释义弹窗状态
  const [selectedWord, setSelectedWord] = useState("");
  const [wordPopupPosition, setWordPopupPosition] = useState({ x: 0, y: 0 });
  const [showWordPopup, setShowWordPopup] = useState(false);
  const [notebooks, setNotebooks] = useState<VocabularyNotebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<number | "">("");

  // 存为文章弹窗状态
  const [showSaveModal, setShowSaveModal] = useState(false);

  const navigate = useNavigate();

  // 加载生词本列表，并恢复上次选择的生词本
  useEffect(() => {
    const loadNotebooks = async () => {
      try {
        const res = await apiClient.get<VocabularyNotebook[]>("/vocabulary/notebooks");
        setNotebooks(res.data);

        // 恢复上次选择的生词本
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
  }, []);

  // 实时翻译（防抖）
  useEffect(() => {
    if (translateTimeoutRef) {
      clearTimeout(translateTimeoutRef);
    }

    if (!sourceText.trim()) {
      setTranslatedText("");
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.post<{ translated_text: string }>("/translation/quick", {
          text: sourceText,
        });
        setTranslatedText(res.data.translated_text || "");
      } catch (err) {
        console.error(err);
        setTranslatedText("翻译失败，请重试");
      } finally {
        setLoading(false);
      }
    }, 500);

    setTranslateTimeoutRef(timeoutId);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [sourceText]);

  // 处理文本选择 - 提取选中的单词
  const handleTextSelect = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowWordPopup(false);
      return;
    }

    const text = selection.toString().trim();
    if (text && text.length > 0 && text.length < 50 && /^[a-zA-Z]+$/.test(text)) {
      // 使用点击位置
      setSelectedWord(text.toLowerCase());
      setWordPopupPosition({
        x: e.clientX,
        y: e.clientY,
      });
      setShowWordPopup(true);
    } else {
      setShowWordPopup(false);
    }
  }, []);

  // 双击处理
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();
    if (text && text.length > 0 && text.length < 50 && /^[a-zA-Z]+$/.test(text)) {
      // 获取点击位置
      const clickX = e.clientX;
      const clickY = e.clientY;

      setSelectedWord(text.toLowerCase());
      setWordPopupPosition({
        x: clickX,
        y: clickY,
      });
      setShowWordPopup(true);
    }
  }, []);

  // 添加生词
  const handleAddWord = async (
    word: string,
    notebookId?: number,
    wordData?: {
      phonetic?: string;
      chinese_translation?: string;
      uk_phonetic?: string;
      us_phonetic?: string;
      uk_audio?: string;
      us_audio?: string;
      meanings_json?: string;
    }
  ) => {
    try {
      if (!notebookId) {
        alert("请选择要添加到的生词本");
        return;
      }

      // 构建完整的 meanings_json
      const meaningsData = wordData?.meanings_json ? JSON.parse(wordData.meanings_json || "[]") : [];
      const fullMeaningsJson = JSON.stringify({
        meanings: meaningsData,
        chinese_translation: wordData?.chinese_translation,
        uk_phonetic: wordData?.uk_phonetic,
        us_phonetic: wordData?.us_phonetic,
        uk_audio: wordData?.uk_audio,
        us_audio: wordData?.us_audio,
      });

      await apiClient.post("/vocabulary", {
        word: word,
        lemma: word.toLowerCase(),
        notebook_id: notebookId,
        phonetic: wordData?.phonetic,
        meanings_json: fullMeaningsJson,
        pronunciation_url: wordData?.uk_audio || wordData?.us_audio,
      });
      setShowWordPopup(false);

      // 保存当前选择的生词本到 localStorage
      localStorage.setItem("lastNotebookId", String(notebookId));

      // 显示右下角提示
      showToast(`单词 "${word}" 已添加到生词本`);
    } catch (err) {
      console.error(err);
      alert("添加生词失败");
    }
  };

  // 右下角提示 toast
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast({ message: "", visible: false });
    }, 3000);
  };

  // 保存文章
  const handleSaveArticle = async (title: string, note: string) => {
    if (!sourceText.trim()) {
      alert("请输入要保存的文章内容");
      return;
    }

    try {
      // 先创建文章
      const res = await apiClient.post<{ id: number }>("/articles", {
        title: title,
        original_text: sourceText,
        note: note || undefined,
      });

      // 如果有翻译结果，更新文章
      if (translatedText) {
        await apiClient.post(`/articles/${res.data.id}/translate`);
      }

      setShowSaveModal(false);
      navigate(`/articles/${res.data.id}`);
    } catch (err) {
      console.error(err);
      alert("保存失败");
    }
  };

  const handleClear = () => {
    setSourceText("");
    setTranslatedText("");
    setShowWordPopup(false);
  };

  return (
    <div className="page-container translate-page">
      <div className="page-header">
        <h1>翻译</h1>
        <button className="secondary-btn" onClick={handleClear}>
          清除
        </button>
      </div>

      {/* 翻译输入区域 */}
      <div className="translate-main">
        {/* 左侧：原文 */}
        <div className="translate-panel source-panel">
          <div className="panel-header">
            <span className="panel-lang">英文</span>
          </div>
          <textarea
            ref={textareaRef}
            className="translate-textarea"
            placeholder="在此粘贴英文文本..."
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            onMouseUp={(e) => handleTextSelect(e)}
            onDoubleClick={(e) => handleDoubleClick(e)}
          />
        </div>

        {/* 右侧：译文 */}
        <div className="translate-panel target-panel">
          <div className="panel-header">
            <span className="panel-lang">中文</span>
            {loading && <span className="translating-indicator">翻译中...</span>}
          </div>
          <div
            className="translate-result"
            onMouseUp={(e) => handleTextSelect(e)}
            onDoubleClick={(e) => handleDoubleClick(e)}
          >
            {translatedText ? (
              translatedText
            ) : (
              <span className="placeholder-text">
                {sourceText.trim() ? "正在翻译..." : "翻译结果将显示在此处"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 底部保存按钮（小按钮） */}
      <div className="translate-save-bar">
        <button
          className="secondary-btn save-article-btn"
          onClick={() => setShowSaveModal(true)}
          disabled={!sourceText.trim()}
        >
          存为文章
        </button>
      </div>

      {/* 单词释义弹窗 */}
      {showWordPopup && (
        <WordPopup
          word={selectedWord}
          position={wordPopupPosition}
          onClose={() => setShowWordPopup(false)}
          onAddWord={handleAddWord}
          notebooks={notebooks}
          selectedNotebookId={selectedNotebook === "" ? undefined : selectedNotebook}
          onNotebookChange={setSelectedNotebook}
        />
      )}

      {/* 存为文章弹窗 */}
      {showSaveModal && (
        <SaveArticleModal
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveArticle}
        />
      )}

      {/* 右下角提示 toast */}
      {toast.visible && (
        <div className="toast-notification">
          {toast.message}
        </div>
      )}
    </div>
  );
};
