import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../shared/apiClient";
import { VocabularyItem } from "./types";

function tryParseMeaningsJson(json?: string | null): {
  meanings?: Array<{ partOfSpeech: string; definitions: Array<{ definition: string; example?: string }> }>;
  sentences?: Array<{ english: string; chinese: string }>;
  phrases?: Array<{ phrase: string; translation: string }>;
  synonyms?: string[];
} | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
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

  const parsed = tryParseMeaningsJson(item?.meanings_json);
  const meaningsList = parsed?.meanings || [];
  const sentences = parsed?.sentences || [];
  const phrases = parsed?.phrases || [];
  const synonyms = parsed?.synonyms || [];

  const playAudio = (audioUrl?: string | null) => {
    if (!audioUrl) return;
    new Audio(audioUrl).play();
  };

  // 兼容 ECDICT 旧数据：字面量 \n（反斜杠+n）→ 可读分隔符
  const cleanStr = (s?: string | null) => s?.replace(/\\n/g, "；") ?? "";

  const tagList = item?.tags ? item.tags.split(" ").filter(Boolean) : [];
  const tagLabels: Record<string, string> = { ielts: "IELTS", toefl: "TOEFL", gre: "GRE", cet4: "CET4", cet6: "CET6" };

  const posLabels: Record<string, string> = { n: "n.", v: "v.", a: "adj.", s: "adj.", r: "adv." };
  const enDefLines: Array<{ pos: string; text: string }> = [];
  if (item?.english_definition) {
    item.english_definition.split("\n").forEach(raw => {
      const m = raw.match(/^([nvasr])\s+(.+)/);
      if (m) enDefLines.push({ pos: posLabels[m[1]] || m[1], text: m[2].trim() });
      else if (raw.trim()) enDefLines.push({ pos: "", text: raw.trim() });
    });
  }

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
          {/* 标题行 */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <div className="modal-title">{item.word}</div>

              {/* 标签行：IELTS / TOEFL / GRE / Oxford / Collins */}
              {(tagList.length > 0 || item.oxford || (item.collins && item.collins > 0)) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {tagList.map(t => (
                    <span key={t} className={`word-badge badge-${t}`}>{tagLabels[t] || t.toUpperCase()}</span>
                  ))}
                  {item.oxford && <span className="word-badge badge-oxford">Oxford</span>}
                  {item.collins != null && item.collins > 0 && (
                    <span className="word-badge badge-collins">{"★".repeat(item.collins)}</span>
                  )}
                </div>
              )}

              {/* 音标 */}
              <div className="modal-subtitle" style={{ marginTop: 6 }}>
                {item.uk_phonetic && (
                  <span
                    style={{ cursor: item.uk_audio ? "pointer" : "default", marginRight: 8 }}
                    onClick={() => playAudio(item.uk_audio)}
                  >
                    英 {item.uk_phonetic}{item.uk_audio && " 🔊"}
                  </span>
                )}
                {item.us_phonetic && (
                  <span
                    style={{ cursor: item.us_audio ? "pointer" : "default", marginRight: 8 }}
                    onClick={() => playAudio(item.us_audio)}
                  >
                    美 {item.us_phonetic}{item.us_audio && " 🔊"}
                  </span>
                )}
                {!item.uk_phonetic && !item.us_phonetic && item.phonetic && <span>{item.phonetic} </span>}
                ｜状态：{item.status}｜熟练度：{item.familiarity_score}｜复习次数：{item.review_count}
              </div>
            </div>
            <button className="secondary-btn" onClick={() => navigate("/vocabulary")}>
              返回列表
            </button>
          </div>

          {/* 中文释义 */}
          {item.chinese_translation && (
            <div className="vocab-block-zh">
              <div className="vocab-block-zh-label">中文释义</div>
              <div className="vocab-block-zh-text">{cleanStr(item.chinese_translation)}</div>
            </div>
          )}

          {/* 英文释义 */}
          {enDefLines.length > 0 && (
            <div className="vocab-block-en">
              <div className="vocab-block-en-label">英文释义</div>
              {enDefLines.slice(0, 6).map((line, i) => (
                <div key={i} className="vocab-block-en-line">
                  {line.pos && <span style={{ color: "#38bdf8", fontWeight: 600, marginRight: 4 }}>{line.pos}</span>}
                  {line.text}
                </div>
              ))}
            </div>
          )}

          {/* 词义列表 */}
          <div style={{ marginTop: 12 }}>
            {meaningsList.length > 0 ? (
              <div className="meanings">
                {meaningsList.map((m: any, idx: number) => (
                  <div key={idx} className="meaning">
                    <div className="meaning-pos">{m.partOfSpeech || m.part_of_speech}</div>
                    <ul className="meaning-defs">
                      {(m.definitions || []).slice(0, 8).map((d: any, i: number) => (
                        <li key={i}>{cleanStr(d.definition || d)}</li>
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
          {phrases.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="vocab-section-label">短语</div>
              {phrases.slice(0, 5).map((p: any, idx: number) => (
                <div key={idx} className="vocab-row" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="vocab-phrase-term">{p.phrase}</span>
                  <span className="vocab-row-zh">{p.translation}</span>
                </div>
              ))}
            </div>
          )}

          {/* 例句 */}
          {sentences.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="vocab-section-label">例句</div>
              {sentences.slice(0, 3).map((s: any, idx: number) => (
                <div key={idx} className="vocab-row">
                  <div className="vocab-row-en">{s.english}</div>
                  <div className="vocab-row-zh">{s.chinese}</div>
                </div>
              ))}
            </div>
          )}

          {/* 同义词 */}
          {synonyms.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="vocab-section-label">同义词</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {synonyms.map((s: string, idx: number) => (
                  <span key={idx} className="vocab-phrase-term" style={{ padding: "2px 8px", background: "rgba(56,189,248,0.1)", borderRadius: 4, fontSize: 13 }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

