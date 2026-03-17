import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/apiClient";
import { VocabularyItem } from "../vocabulary/types";

type ReviewItem = { vocab: VocabularyItem };

const FEEDBACKS: Array<{ id: string; label: string; tone: "secondary" | "primary" | "danger" }> = [
  { id: "unknown", label: "不认识", tone: "danger" },
  { id: "vague", label: "模糊", tone: "secondary" },
  { id: "known", label: "认识", tone: "primary" },
  { id: "very_known", label: "很熟悉", tone: "primary" }
];

export const TodayReviewPage = () => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const current = items[index]?.vocab;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<ReviewItem[]>("/reviews/today");
        setItems(res.data);
        setIndex(0);
        setShowAnswer(false);
      } catch (err) {
        console.error(err);
        setError("加载今日复习任务失败。");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const progressText = useMemo(() => {
    if (items.length === 0) return "0/0";
    return `${Math.min(index + 1, items.length)}/${items.length}`;
  }, [index, items.length]);

  const submit = async (feedback: string) => {
    if (!current) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/reviews/${current.id}/submit`, { feedback });
      const next = index + 1;
      if (next >= items.length) {
        setIndex(items.length);
      } else {
        setIndex(next);
      }
      setShowAnswer(false);
    } catch (err) {
      console.error(err);
      setError("提交复习结果失败。");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h1>今日复习</h1>
        <div>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <h1>今日复习</h1>
        <div className="error-text">{error}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page-container">
        <h1>今日复习</h1>
        <div>今天没有需要复习的单词。你可以先去文章里加一些生词。</div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="page-container">
        <h1>今日复习</h1>
        <div className="meaning" style={{ padding: 16 }}>
          <div className="modal-title">已完成</div>
          <div className="modal-subtitle">你已经完成了今天的复习任务。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>今日复习</h1>
        <div className="card-subtitle">进度：{progressText}</div>
      </div>

      <div className="meaning" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div className="modal-title">{current.word}</div>
            <div className="modal-subtitle">
              {current.phonetic ? `${current.phonetic}｜` : ""}
              状态：{current.status}｜熟练度：{current.familiarity_score}
            </div>
          </div>
          <button className="secondary-btn" onClick={() => setShowAnswer((s) => !s)}>
            {showAnswer ? "隐藏释义" : "显示释义"}
          </button>
        </div>

        {showAnswer && (
          <div style={{ marginTop: 12 }}>
            <div className="translation-box">
              {current.meanings_json ? current.meanings_json : "暂无释义数据。"}
            </div>
          </div>
        )}

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {FEEDBACKS.map((f) => (
            <button
              key={f.id}
              disabled={submitting}
              className={f.tone === "danger" ? "danger-btn" : f.tone === "primary" ? "primary-btn" : "secondary-btn"}
              onClick={() => submit(f.id)}
            >
              {submitting ? "提交中..." : f.label}
            </button>
          ))}
        </div>
        {submitting && <div style={{ marginTop: 10, color: "#9ca3af" }}>正在提交并切换下一张…</div>}
      </div>
    </div>
  );
};

