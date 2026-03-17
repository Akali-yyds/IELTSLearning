import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { VocabularyItem } from "./types";

export const VocabularyListPage = () => {
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const params = useMemo(() => {
    if (!statusFilter) return {};
    return { status_filter: statusFilter };
  }, [statusFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
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
  }, [params]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>生词本</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
          {items.length === 0 && <div>暂无生词。你可以在文章阅读区双击单词后加入生词本。</div>}
          {items.map((v) => (
            <Link key={v.id} to={`/vocabulary/${v.id}`} className="card">
              <div className="card-title">
                {v.word} {v.phonetic ? <span style={{ color: "#9ca3af" }}>{v.phonetic}</span> : null}
              </div>
              <div className="card-subtitle">
                状态：{v.status}｜熟练度：{v.familiarity_score}｜下次复习：
                {v.next_review_at ? new Date(v.next_review_at).toLocaleDateString() : "未安排"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

