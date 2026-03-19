import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { VocabularyItem } from "./types";

function tryParseMeanings(json?: string | null) {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    // 检查是否是新的扩展格式（包含 meanings、chinese_translation 等字段）
    if (parsed.meanings || parsed.chinese_translation) {
      return parsed;
    }
    // 旧的简单格式
    return parsed as Array<{
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

  // 判断是否是新的扩展格式
  const isExtendedFormat = meanings && typeof meanings === "object" && "meanings" in meanings;
  const extraInfo = isExtendedFormat ? meanings : null;
  const meaningsList = isExtendedFormat ? (meanings as any).meanings : meanings;

  // 播放发音
  const playAudio = (audioUrl?: string) => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.play();
  };

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
                {/* 音标和发音 */}
                {(extraInfo?.uk_phonetic || extraInfo?.us_phonetic) && (
                  <span>
                    {extraInfo.uk_phonetic && (
                      <span
                        style={{ cursor: extraInfo.uk_audio ? "pointer" : "default", marginRight: 8 }}
                        onClick={() => playAudio(extraInfo.uk_audio)}
                      >
                        英 {extraInfo.uk_phonetic}
                        {extraInfo.uk_audio && " 🔊"}
                      </span>
                    )}
                    {extraInfo.us_phonetic && (
                      <span
                        style={{ cursor: extraInfo.us_audio ? "pointer" : "default" }}
                        onClick={() => playAudio(extraInfo.us_audio)}
                      >
                        美 {extraInfo.us_phonetic}
                        {extraInfo.us_audio && " 🔊"}
                      </span>
                    )}
                    {"｜"}
                  </span>
                )}
                {item.phonetic && !extraInfo && <span>{item.phonetic}｜</span>}
                状态：{item.status}｜熟练度：{item.familiarity_score}｜复习次数：{item.review_count}
              </div>
            </div>
            <button className="secondary-btn" onClick={() => navigate("/vocabulary")}>
              返回列表
            </button>
          </div>

          {/* 中文释义 */}
          {extraInfo?.chinese_translation && (
            <div style={{ marginTop: 16, padding: 12, background: "rgba(251, 191, 36, 0.1)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 4 }}>中文释义</div>
              <div style={{ fontSize: 15, color: "#e2e8f0" }}>{extraInfo.chinese_translation}</div>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {meaningsList && meaningsList.length > 0 ? (
              <div className="meanings">
                {meaningsList.map((m: any, idx: number) => (
                  <div key={idx} className="meaning">
                    <div className="meaning-pos">{m.partOfSpeech || m.part_of_speech}</div>
                    <ul className="meaning-defs">
                      {(m.definitions || []).slice(0, 8)?.map((d: any, i: number) => (
                        <li key={i}>{d.definition || d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#9ca3af" }}>暂无释义数据。</div>
            )}
          </div>

          {/* 短语 */}
          {extraInfo?.phrases && extraInfo.phrases.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>短语</div>
              {extraInfo.phrases.slice(0, 5).map((p: any, idx: number) => (
                <div key={idx} style={{ padding: "8px 0", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#38bdf8" }}>{p.phrase}</span>
                  <span style={{ color: "#9ca3af" }}>{p.translation}</span>
                </div>
              ))}
            </div>
          )}

          {/* 例句 */}
          {extraInfo?.sentences && extraInfo.sentences.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>例句</div>
              {extraInfo.sentences.slice(0, 3).map((s: any, idx: number) => (
                <div key={idx} style={{ padding: "8px 0", borderBottom: "1px solid #1f2937" }}>
                  <div style={{ color: "#e2e8f0", marginBottom: 4 }}>{s.english}</div>
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>{s.chinese}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

