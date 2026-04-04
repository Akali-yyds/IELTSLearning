import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { VocabularyNotebook } from "../vocabulary/types";
import { LazyWordPopup } from "../dictionary/LazyWordPopup";

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

  // 保存文章弹窗状态
  const [showSaveModal, setShowSaveModal] = useState(false);

  const navigate = useNavigate();

  // 鍔犺浇鐢熻瘝鏈垪琛紝骞舵仮澶嶄笂娆￠€夋嫨鐨勭敓璇嶆湰
  useEffect(() => {
    const loadNotebooks = async () => {
      try {
        const res = await apiClient.get<VocabularyNotebook[]>("/vocabulary/notebooks");
        setNotebooks(res.data);

        // 鎭㈠涓婃閫夋嫨鐨勭敓璇嶆湰
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

  // 瀹炴椂缈昏瘧锛堥槻鎶栵級
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

  // 处理文本选择，提取选中的单词
  const handleTextSelect = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowWordPopup(false);
      return;
    }

    const text = selection.toString().trim();
    if (text && text.length > 0 && text.length < 50 && /^[a-zA-Z]+$/.test(text)) {
      // 浣跨敤鐐瑰嚮浣嶇疆
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

  // 鍙屽嚮澶勭悊
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();
    if (text && text.length > 0 && text.length < 50 && /^[a-zA-Z]+$/.test(text)) {
      // 鑾峰彇鐐瑰嚮浣嶇疆
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

  // 娣诲姞鐢熻瘝
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

      // meanings_json 鍙瓨澶嶆潅宓屽缁撴瀯锛歞efinitions / sentences / phrases / synonyms
      const meaningsJson = JSON.stringify({
        meanings: wordData?.meanings || [],
        sentences: wordData?.sentences || [],
        phrases: wordData?.phrases || [],
        synonyms: wordData?.synonyms || [],
      });

      // tags 转为空格分隔字符串
      const tagsStr = wordData?.tags
        ? Object.entries(wordData.tags).filter(([, v]) => v).map(([k]) => k).join(" ")
        : undefined;

      const res = await apiClient.post("/vocabulary", {
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
        meanings_json: meaningsJson,
        pronunciation_url: wordData?.uk_audio || wordData?.us_audio,
      });
      setShowWordPopup(false);

      // 保存当前选择的生词本到 localStorage
      localStorage.setItem("lastNotebookId", String(notebookId));

      showToast(
        res.status === 200
          ? `单词 "${word}" 已存在于生词书中`
          : `单词 "${word}" 已添加到生词本`
      );
    } catch (err) {
      console.error(err);
      alert("添加生词失败");
    }
  };

  // 鍙充笅瑙掓彁绀?toast
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast({ message: "", visible: false });
    }, 3000);
  };

  // 淇濆瓨鏂囩珷
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

      // 濡傛灉鏈夌炕璇戠粨鏋滐紝鏇存柊鏂囩珷
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

      {/* 缈昏瘧杈撳叆鍖哄煙 */}
      <div className="translate-main">
        {/* 宸︿晶锛氬師鏂?*/}
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

        {/* 鍙充晶锛氳瘧鏂?*/}
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

      {/* 搴曢儴淇濆瓨鎸夐挳锛堝皬鎸夐挳锛?*/}
      <div className="translate-save-bar">
        <button
          className="secondary-btn save-article-btn"
          onClick={() => setShowSaveModal(true)}
          disabled={!sourceText.trim()}
        >
          存为文章
        </button>
      </div>

      {/* 鍗曡瘝閲婁箟寮圭獥 */}
      {showWordPopup && (
        <LazyWordPopup
          word={selectedWord}
          position={wordPopupPosition}
          onClose={() => setShowWordPopup(false)}
          onAddWord={handleAddWord}
          notebooks={notebooks}
          selectedNotebookId={selectedNotebook === "" ? undefined : selectedNotebook}
          onNotebookChange={setSelectedNotebook}
        />
      )}

      {/* 瀛樹负鏂囩珷寮圭獥 */}
      {showSaveModal && (
        <SaveArticleModal
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveArticle}
        />
      )}

      {/* 鍙充笅瑙掓彁绀?toast */}
      {toast.visible && (
        <div className="toast-notification">
          {toast.message}
        </div>
      )}
    </div>
  );
};

