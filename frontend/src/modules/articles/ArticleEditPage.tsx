import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { VocabularyNotebook } from "../vocabulary/types";
import { WordPopup } from "../dictionary/WordLookupModal";

interface Article {
  id?: number;
  title: string;
  original_text: string;
  translated_text?: string | null;
}

export const ArticleEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [form, setForm] = useState<Article>({ title: "", original_text: "" });
  const [loading, setLoading] = useState(false);
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 单词释义弹窗状态
  const [selectedWord, setSelectedWord] = useState("");
  const [wordPopupPosition, setWordPopupPosition] = useState({ x: 0, y: 0 });
  const [showWordPopup, setShowWordPopup] = useState(false);
  const [notebooks, setNotebooks] = useState<VocabularyNotebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<number | "">("");

  const articleId = useMemo(() => {
    if (!id) return undefined;
    const n = Number(id);
    return Number.isFinite(n) ? n : undefined;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<Article>(`/articles/${id}`);
        setForm(res.data);
      } catch (err) {
        console.error(err);
        setError("加载文章失败。");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // 加载生词本列表，并恢复上次选择的生词本
  useEffect(() => {
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
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isNew) {
        const res = await apiClient.post<Article>("/articles", {
          title: form.title,
          original_text: form.original_text
        });
        navigate(`/articles/${res.data.id}`);
      } else {
        await apiClient.put(`/articles/${id}`, {
          title: form.title,
          original_text: form.original_text
        });
      }
    } catch (err) {
      console.error(err);
      setError("保存失败。");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm("确定要删除这篇文章吗？")) return;
    try {
      await apiClient.delete(`/articles/${id}`);
      navigate("/articles");
    } catch (err) {
      console.error(err);
      setError("删除失败。");
    }
  };

  const handleTranslate = async () => {
    if (!id) {
      alert("请先保存文章，再进行翻译。");
      return;
    }
    setLoadingTranslate(true);
    setError(null);
    try {
      const res = await apiClient.post<Article>(`/articles/${id}/translate`);
      setForm((prev) => ({ ...prev, translated_text: res.data.translated_text }));
    } catch (err) {
      console.error(err);
      setError("翻译失败。");
    } finally {
      setLoadingTranslate(false);
    }
  };

  // 处理文本选择 - 提取选中的单词
  const handleTextSelect = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowWordPopup(false);
      return;
    }

    const text = selection.toString().trim();
    if (text && text.length > 0 && text.length < 50 && /^[a-zA-Z]+$/.test(text)) {
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
      setSelectedWord(text.toLowerCase());
      setWordPopupPosition({
        x: e.clientX,
        y: e.clientY,
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
        source_article_id: articleId ?? null,
      });
      setShowWordPopup(false);
      localStorage.setItem("lastNotebookId", String(notebookId));
    } catch (err) {
      console.error(err);
      alert("添加生词失败");
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <button className="secondary-btn" onClick={() => navigate(-1)}>
            ← 返回
          </button>
          <h1>{isNew ? "新建文章" : "编辑文章"}</h1>
        </div>
        {!isNew && (
          <button className="danger-btn" onClick={handleDelete}>
            删除
          </button>
        )}
      </div>

      {loading && !isNew && <div>加载中...</div>}
      {error && <div className="error-text">{error}</div>}

      <form onSubmit={handleSubmit} className="article-edit-layout">
        <div className="article-title-row">
          <label className="article-title-label">
            标题
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
        </div>

        <div className="article-split-view">
          {/* 左侧：英文原文 */}
          <div className="article-original-panel">
            <div className="translation-header">
              <h2>英文原文</h2>
            </div>
            <textarea
              className="article-original-textarea"
              rows={20}
              value={form.original_text}
              onChange={(e) => setForm({ ...form, original_text: e.target.value })}
              placeholder="在这里粘贴英文文章..."
              required
              onMouseUp={(e) => handleTextSelect(e)}
              onDoubleClick={(e) => handleDoubleClick(e)}
            />
          </div>

          {/* 右侧：中文译文 */}
          <div className="article-right-panel">
            <div className="translation-header">
              <h2>中文译文</h2>
              {form.translated_text && (
                <span className="translation-status">已翻译</span>
              )}
            </div>
            <div
              className="translation-content"
              onMouseUp={(e) => handleTextSelect(e)}
              onDoubleClick={(e) => handleDoubleClick(e)}
            >
              {form.translated_text ? (
                form.translated_text
              ) : (
                <div className="translation-placeholder">
                  {id ? "点击「全文翻译」按钮获取翻译" : "保存文章后可进行翻译"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="article-actions">
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleTranslate}
            disabled={loadingTranslate}
          >
            {loadingTranslate ? "翻译中..." : "全文翻译"}
          </button>
        </div>
      </form>

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
    </div>
  );
};
