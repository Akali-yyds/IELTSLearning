import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiClient, resolveApiUrl } from "../../shared/apiClient";
import { VocabularyNotebook } from "../vocabulary/types";

interface ReviewWord {
  id: number;
  word: string;
  lemma: string;
  phonetic: string | null;
  chinese_translation?: string | null;
  uk_phonetic?: string | null;
  us_phonetic?: string | null;
  uk_audio?: string | null;
  us_audio?: string | null;
  tags?: string | null;
  collins?: number | null;
  oxford?: boolean | null;
  bnc?: number | null;
  frq?: number | null;
  meanings_json: string | null;
  familiarity_score: number;
  ease_factor: number;
  interval_days: number;
  next_review_at: string | null;
  review_count: number;
}

interface WordExtraInfo {
  meanings?: any[];
  chinese_translation?: string;
  uk_phonetic?: string;
  us_phonetic?: string;
  tags?: Record<string, boolean>;
  collins?: number;
  oxford?: boolean;
  bnc?: number;
  frq?: number;
  sentences?: Array<{ english: string; chinese: string }>;
  phrases?: Array<{ phrase: string; translation: string }>;
  synonyms?: string[];
}

export const ReviewPage = () => {
  const { notebookId } = useParams<{ notebookId?: string }>();
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<VocabularyNotebook[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<number | null>(
    notebookId ? parseInt(notebookId) : null
  );
  const [reviewWords, setReviewWords] = useState<ReviewWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // 加载生词本列表
  useEffect(() => {
    const loadNotebooks = async () => {
      try {
        const res = await apiClient.get<VocabularyNotebook[]>("/vocabulary/notebooks");
        setNotebooks(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    loadNotebooks();
  }, []);

  // 加载复习单词
  useEffect(() => {
    if (!selectedNotebookId) {
      setLoading(false);
      return;
    }

    const loadReviewWords = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<ReviewWord[]>(
          `/vocabulary/notebooks/${selectedNotebookId}/review`
        );
        setReviewWords(res.data);
        setCurrentIndex(0);
        setShowAnswer(false);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadReviewWords();
  }, [selectedNotebookId]);

  const currentWord = reviewWords[currentIndex];

  // 解析 meanings_json
  const getExtraInfo = (): WordExtraInfo | null => {
    if (!currentWord?.meanings_json) return null;
    try {
      const parsed = JSON.parse(currentWord.meanings_json);
      if (parsed.meanings || parsed.chinese_translation || parsed.uk_phonetic) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const extraInfo = getExtraInfo();

  const playAudio = (audioUrl?: string | null) => {
    if (!audioUrl || audioPlaying) return;
    setAudioPlaying(true);
    const audio = new Audio(resolveApiUrl(audioUrl));
    audio.onended = () => setAudioPlaying(false);
    audio.onerror = () => setAudioPlaying(false);
    void audio.play().catch((err) => {
      console.error(err);
      setAudioPlaying(false);
    });
  };

  const handleFeedback = async (feedback: "again" | "hard" | "good" | "easy") => {
    if (!currentWord || submitting) return;
    setSubmitting(true);

    try {
      await apiClient.post(`/vocabulary/${currentWord.id}/review`, {
        feedback,
      });

      if (currentIndex < reviewWords.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        const res = await apiClient.get<ReviewWord[]>(
          `/vocabulary/notebooks/${selectedNotebookId}/review`
        );
        setReviewWords(res.data);
        setCurrentIndex(0);
        setShowAnswer(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // 选择生词本
  if (!selectedNotebookId) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>记单词</h1>
        </div>
        <div className="review-select-notebook">
          <p className="review-select-title">选择要复习的生词本</p>
          {notebooks.length === 0 ? (
            <div className="empty-state">
              <p>还没有生词本</p>
              <Link to="/vocabulary" className="primary-btn">
                创建生词本
              </Link>
            </div>
          ) : (
            <div className="notebook-grid">
              {notebooks.map((nb) => (
                <button
                  key={nb.id}
                  className="notebook-review-card"
                  onClick={() => setSelectedNotebookId(nb.id)}
                >
                  <div className="notebook-review-icon">📚</div>
                  <div className="notebook-review-name">{nb.name}</div>
                  <div className="notebook-review-count">{nb.word_count} 个单词</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 加载中
  if (loading) {
    return (
      <div className="page-container">
        <div className="centered">加载中...</div>
      </div>
    );
  }

  // 没有需要复习的单词
  if (reviewWords.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="page-header-left">
            <button className="secondary-btn" onClick={() => setSelectedNotebookId(null)}>
              ← 返回
            </button>
            <h1>记单词</h1>
          </div>
        </div>
        <div className="review-complete">
          <div className="review-complete-icon">🎉</div>
          <h2>太棒了！</h2>
          <p>当前没有需要复习的单词</p>
          <button
            className="primary-btn"
            onClick={() => navigate(`/vocabulary/notebook/${selectedNotebookId}`)}
          >
            查看生词本
          </button>
        </div>
      </div>
    );
  }

  // 从 extraInfo 或 word 字段提取标签
  const tagList: Array<{ label: string; cls: string }> = [];
  if (extraInfo?.tags) {
    if (extraInfo.tags.ielts) tagList.push({ label: "IELTS", cls: "badge-ielts" });
    if (extraInfo.tags.toefl) tagList.push({ label: "TOEFL", cls: "badge-toefl" });
    if (extraInfo.tags.gre) tagList.push({ label: "GRE", cls: "badge-gre" });
    if (extraInfo.tags.cet4) tagList.push({ label: "CET4", cls: "badge-cet4" });
    if (extraInfo.tags.cet6) tagList.push({ label: "CET6", cls: "badge-cet6" });
  }
  if (currentWord?.tags) {
    const currentTags = currentWord.tags.split(" ").filter(Boolean);
    if (currentTags.includes("ielts") && !tagList.some((t) => t.label === "IELTS")) tagList.push({ label: "IELTS", cls: "badge-ielts" });
    if (currentTags.includes("toefl") && !tagList.some((t) => t.label === "TOEFL")) tagList.push({ label: "TOEFL", cls: "badge-toefl" });
    if (currentTags.includes("gre") && !tagList.some((t) => t.label === "GRE")) tagList.push({ label: "GRE", cls: "badge-gre" });
    if (currentTags.includes("cet4") && !tagList.some((t) => t.label === "CET4")) tagList.push({ label: "CET4", cls: "badge-cet4" });
    if (currentTags.includes("cet6") && !tagList.some((t) => t.label === "CET6")) tagList.push({ label: "CET6", cls: "badge-cet6" });
  }
  if (currentWord?.oxford && !tagList.some((t) => t.label === "Oxford")) {
    tagList.push({ label: "Oxford", cls: "badge-oxford" });
  }
  if (currentWord?.collins && !tagList.some((t) => t.cls === "badge-collins")) {
    tagList.push({ label: `${"★".repeat(currentWord.collins)}`, cls: "badge-collins" });
  }
  if (extraInfo?.oxford) {
    tagList.push({ label: "Oxford", cls: "badge-oxford" });
  }
  if (extraInfo?.collins) {
    tagList.push({ label: `${"★".repeat(extraInfo.collins)}`, cls: "badge-collins" });
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <button className="secondary-btn" onClick={() => setSelectedNotebookId(null)}>
            ← 返回
          </button>
          <h1>记单词</h1>
        </div>
        <div className="review-progress">
          {currentIndex + 1} / {reviewWords.length}
        </div>
      </div>

      {/* 进度条 */}
      <div className="review-progress-bar">
        <div
          className="review-progress-fill"
          style={{ width: `${((currentIndex + 1) / reviewWords.length) * 100}%` }}
        />
      </div>

      {/* 单词卡片 */}
      <div className="review-card">
        {/* 单词 */}
        <div className="review-word-row">
          <div className="review-word">{currentWord.word}</div>
          {(currentWord.uk_audio || currentWord.us_audio) && (
            <button
              type="button"
              className="review-audio-btn"
              onClick={() => playAudio(currentWord.uk_audio || currentWord.us_audio)}
              disabled={audioPlaying}
              title="播放发音"
            >
              {audioPlaying ? "…" : "▶"}
            </button>
          )}
        </div>

        {/* 标签行 */}
        {tagList.length > 0 && (
          <div className="review-badges">
            {tagList.map((t, i) => (
              <span key={i} className={`word-badge ${t.cls}`}>{t.label}</span>
            ))}
          </div>
        )}

        {/* 显示音标 */}
        {(extraInfo?.uk_phonetic || extraInfo?.us_phonetic || currentWord.phonetic) && (
          <div className="review-phonetic">
            {(extraInfo?.uk_phonetic || currentWord.uk_phonetic) && <span style={{ marginRight: 12 }}>英 {extraInfo?.uk_phonetic || currentWord.uk_phonetic}</span>}
            {(extraInfo?.us_phonetic || currentWord.us_phonetic) && <span>美 {extraInfo?.us_phonetic || currentWord.us_phonetic}</span>}
            {!extraInfo?.uk_phonetic && !extraInfo?.us_phonetic && !currentWord.uk_phonetic && !currentWord.us_phonetic && currentWord.phonetic}
          </div>
        )}

        {!showAnswer ? (
          <button className="review-show-answer-btn" onClick={() => setShowAnswer(true)}>
            显示答案
          </button>
        ) : (
          <div className="review-answer">
            {/* 中文释义 */}
            {(extraInfo?.chinese_translation || currentWord.chinese_translation) && (
              <div className="review-chinese">{extraInfo?.chinese_translation || currentWord.chinese_translation}</div>
            )}

            {/* 词义列表 */}
            {extraInfo?.meanings && extraInfo.meanings.length > 0 && (
              <div className="review-meanings">
                {extraInfo.meanings.map((m: any, i: number) => (
                  <div key={i} className="review-meaning-item">
                    <span className="review-pos">{m.partOfSpeech || m.part_of_speech}</span>
                    <span className="review-def">{m.definitions?.[0]?.definition || m.definitions?.[0] || ""}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 短语 */}
            {extraInfo?.phrases && extraInfo.phrases.length > 0 && (
              <div className="review-section">
                <div className="review-section-title">短语</div>
                {extraInfo.phrases.slice(0, 3).map((p: any, i: number) => (
                  <div key={i} className="review-phrase">
                    <span className="phrase-text">{p.phrase}</span>
                    <span className="phrase-trans">{p.translation}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 例句 */}
            {extraInfo?.sentences && extraInfo.sentences.length > 0 && (
              <div className="review-section">
                <div className="review-section-title">例句</div>
                {extraInfo.sentences.slice(0, 2).map((s: any, i: number) => (
                  <div key={i} className="review-sentence">
                    <div className="sentence-en">{s.english}</div>
                    <div className="sentence-cn">{s.chinese}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 同义词 */}
            {extraInfo?.synonyms && extraInfo.synonyms.length > 0 && (
              <div className="review-section">
                <div className="review-section-title">同义词</div>
                <div className="review-synonyms">
                  {extraInfo.synonyms.slice(0, 5).map((syn: string, i: number) => (
                    <span key={i} className="review-synonym-tag">{syn}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 评价按钮 */}
      {showAnswer && (
        <div className="review-buttons">
          <button
            className="review-btn again"
            onClick={() => handleFeedback("again")}
            disabled={submitting}
          >
            不认识
          </button>
          <button
            className="review-btn hard"
            onClick={() => handleFeedback("hard")}
            disabled={submitting}
          >
            困难
          </button>
          <button
            className="review-btn good"
            onClick={() => handleFeedback("good")}
            disabled={submitting}
          >
            认识
          </button>
          <button
            className="review-btn easy"
            onClick={() => handleFeedback("easy")}
            disabled={submitting}
          >
            简单
          </button>
        </div>
      )}
    </div>
  );
};
