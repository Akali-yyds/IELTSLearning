import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { VocabularyItem } from "./types";

function tryParseMeanings(json?: string | null) {
  if (!json) return null;
  try {
    return JSON.parse(json) as Array<{
      part_of_speech: string;
      definitions: string[];
      examples?: string[];
    }>;
  } catch {
    return null;
  }
}

export const VocabularyDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const vocabId = useMemo(() => (id ? Number(id) : NaN), [id]);

  const [item, setItem] = useState<VocabularyItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(vocabId)) {
      setError("参数错误。");
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<VocabularyItem>(`/vocabulary/${vocabId}`);
        setItem(res.data);
      } catch (err) {
        console.error(err);
        setError("加载生词详情失败。");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vocabId]);

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm(`确定要删除生词 "${item.word}" 吗？`)) return;
    try {
      await apiClient.delete(`/vocabulary/${item.id}`);
      navigate("/vocabulary");
    } catch (err) {
      console.error(err);
      setError("删除失败。");
    }
  };

  const meanings = tryParseMeanings(item?.meanings_json);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>生词详情</h1>
        <button className="danger-btn" onClick={handleDelete}>
          删除
        </button>
      </div>

      {loading && <div>加载中...</div>}
      {error && <div className="error-text">{error}</div>}

      {item && !loading && (
        <div className="meaning" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div className="modal-title">{item.word}</div>
              <div className="modal-subtitle">
                {item.phonetic ? `${item.phonetic}｜` : ""}
                状态：{item.status}｜熟练度：{item.familiarity_score}｜复习次数：{item.review_count}
              </div>
            </div>
            <button className="secondary-btn" onClick={() => navigate("/vocabulary")}>
              返回列表
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            {meanings ? (
              <div className="meanings">
                {meanings.map((m, idx) => (
                  <div key={idx} className="meaning">
                    <div className="meaning-pos">{m.part_of_speech}</div>
                    <ul className="meaning-defs">
                      {m.definitions?.slice(0, 8)?.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                    {m.examples?.length ? <div className="meaning-ex">例句：{m.examples[0]}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#9ca3af" }}>暂无释义数据。</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

