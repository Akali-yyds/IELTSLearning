import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/apiClient";
import { DictionaryEntry } from "./types";

function normalizeWord(raw: string) {
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "");
  return cleaned.toLowerCase();
}

export const WordLookupModal = (props: {
  open: boolean;
  rawWord: string;
  sourceArticleId?: number;
  onClose: () => void;
}) => {
  const normalized = useMemo(() => normalizeWord(props.rawWord), [props.rawWord]);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    if (!normalized) {
      setEntry(null);
      setError("无法识别单词，请重新选择。");
      return;
    }

    setLoading(true);
    setError(null);
    setAdded(false);
    apiClient
      .get<DictionaryEntry>("/dictionary", { params: { word: normalized } })
      .then((res) => setEntry(res.data))
      .catch((err) => {
        console.error(err);
        setError("查词失败。");
      })
      .finally(() => setLoading(false));
  }, [props.open, normalized]);

  const handleAdd = async () => {
    if (!entry) return;
    setAdding(true);
    try {
      await apiClient.post("/vocabulary", {
        word: entry.word,
        lemma: entry.lemma,
        phonetic: entry.phonetic ?? null,
        meanings_json: JSON.stringify(entry.meanings),
        pronunciation_url: entry.pronunciation_url ?? null,
        source_article_id: props.sourceArticleId ?? null
      });
      setAdded(true);
    } catch (err) {
      console.error(err);
      setError("加入生词本失败。");
    } finally {
      setAdding(false);
    }
  };

  if (!props.open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={props.onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{normalized || props.rawWord}</div>
            {entry?.phonetic && <div className="modal-subtitle">{entry.phonetic}</div>}
          </div>
          <button className="secondary-btn" onClick={props.onClose}>
            关闭
          </button>
        </div>

        {loading && <div>查词中...</div>}
        {error && <div className="error-text">{error}</div>}

        {entry && (
          <div className="modal-body">
            <div className="meanings">
              {entry.meanings.map((m, idx) => (
                <div key={idx} className="meaning">
                  <div className="meaning-pos">{m.part_of_speech}</div>
                  <ul className="meaning-defs">
                    {m.definitions.slice(0, 4).map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                  {m.examples?.length > 0 && (
                    <div className="meaning-ex">
                      例句：{m.examples[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="primary-btn" onClick={handleAdd} disabled={adding || added}>
                {added ? "已加入生词本" : adding ? "加入中..." : "加入生词本"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

