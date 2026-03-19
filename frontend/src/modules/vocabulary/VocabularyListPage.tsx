import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { VocabularyItem, VocabularyNotebook } from "./types";

export const VocabularyListPage = () => {
  const { notebookId } = useParams<{ notebookId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [notebook, setNotebook] = useState<VocabularyNotebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const notebookIdNum = notebookId ? parseInt(notebookId) : null;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // 如果有notebookId，先获取notebook信息
        if (notebookIdNum) {
          const nbRes = await apiClient.get<VocabularyNotebook>(`/vocabulary/notebooks/${notebookIdNum}`);
          setNotebook(nbRes.data);
        }

        // 获取词汇列表
        const params: Record<string, string> = {};
        if (notebookIdNum) {
          params.notebook_id = String(notebookIdNum);
        }
        if (statusFilter) {
          params.status_filter = statusFilter;
        }

        const res = await apiClient.get<VocabularyItem[]>("/vocabulary", { params });
        setItems(res.data);
      } catch (err) {
        console.error(err);
        setError("加载生词本失败。");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [notebookIdNum, statusFilter]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="secondary-btn" onClick={() => navigate("/vocabulary")} style={{ padding: "6px 12px" }}>
            ← 返回
          </button>
          <h1>{notebook ? notebook.name : "所有生词"}</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {notebookIdNum && notebook && notebook.word_count > 0 && (
            <button
              className="primary-btn"
              onClick={() => navigate(`/review/${notebookIdNum}`)}
              style={{ padding: "8px 16px" }}
            >
              开始复习
            </button>
          )}
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>状态</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                borderRadius: 999,
                border: "1px solid #1f2937",
                background: "#020617",
                color: "#e5e7eb",
                padding: "8px 10px"
              }}
            >
              <option value="">全部</option>
              <option value="new">new</option>
              <option value="learning">learning</option>
              <option value="reviewing">reviewing</option>
              <option value="mastered">mastered</option>
            </select>
          </label>
        </div>
      </div>

      {loading && <div>加载中...</div>}
      {error && <div className="error-text">{error}</div>}

          {!loading && !error && (
        <div className="card-list">
          {items.length === 0 && <div className="empty-state">暂无生词。你可以在文章阅读区双击单词后加入生词本。</div>}
          {items.map((v) => {
            // 尝试解析 meanings_json 中的额外信息
            let extraInfo: any = null;
            try {
              if (v.meanings_json) {
                const parsed = JSON.parse(v.meanings_json);
                // 如果是对象格式（包含 meanings、chinese_translation 等），则是新格式
                if (parsed.meanings || parsed.chinese_translation) {
                  extraInfo = parsed;
                }
              }
            } catch {}

            return (
              <Link key={v.id} to={`/vocabulary/${v.id}`} className="card">
                <div className="card-title">
                  {v.word}
                  {extraInfo?.uk_phonetic && <span style={{ color: "#9ca3af", marginLeft: 8 }}>{extraInfo.uk_phonetic}</span>}
                  {v.phonetic && !extraInfo && <span style={{ color: "#9ca3af" }}>{v.phonetic}</span>}
                </div>
                <div className="card-subtitle">
                  {extraInfo?.chinese_translation || (v.meanings_json ? JSON.parse(v.meanings_json || "[]").map((m: any) => m.definitions?.[0]).filter(Boolean).join("；") : "")}
                </div>
                <div className="card-subtitle" style={{ marginTop: 4, fontSize: 12 }}>
                  状态：{v.status}｜熟练度：{v.familiarity_score}｜复习：{v.review_count}次
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

