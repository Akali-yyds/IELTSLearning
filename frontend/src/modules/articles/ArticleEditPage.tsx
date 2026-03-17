import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { WordLookupModal } from "../dictionary/WordLookupModal";

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
  const [lookupOpen, setLookupOpen] = useState(false);
  const [rawWord, setRawWord] = useState("");

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

  const handleDoubleClickLookup = () => {
    const selection = window.getSelection()?.toString() ?? "";
    const candidate = selection.trim();
    if (!candidate) return;
    setRawWord(candidate);
    setLookupOpen(true);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{isNew ? "新建文章" : "编辑文章"}</h1>
        {!isNew && (
          <button className="danger-btn" onClick={handleDelete}>
            删除
          </button>
        )}
      </div>

      {loading && !isNew && <div>加载中...</div>}
      {error && <div className="error-text">{error}</div>}

      <div className="article-split-view">
        {/* 左侧：原文编辑区 */}
        <div className="article-left-panel">
          <form onSubmit={handleSubmit} className="article-form">
            <label>
              标题
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>
            <label className="original-text-label">
              英文原文
              <textarea
                rows={20}
                value={form.original_text}
                onChange={(e) => setForm({ ...form, original_text: e.target.value })}
                placeholder="在这里粘贴英文文章..."
                required
                onDoubleClick={handleDoubleClickLookup}
              />
            </label>
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
        </div>

        {/* 右侧：翻译结果区 */}
        <div className="article-right-panel">
          <div className="translation-header">
            <h2>中文译文</h2>
            {form.translated_text && (
              <span className="translation-status">已翻译</span>
            )}
          </div>
          <div className="translation-content">
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

      <WordLookupModal
        open={lookupOpen}
        rawWord={rawWord}
        sourceArticleId={articleId}
        onClose={() => setLookupOpen(false)}
      />
    </div>
  );
};

