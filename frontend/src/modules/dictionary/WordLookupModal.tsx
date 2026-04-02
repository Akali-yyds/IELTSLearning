import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/apiClient";
import { VocabularyNotebook } from "../vocabulary/types";
import { LazyWordPopup } from "./LazyWordPopup";

function normalizeWord(raw: string) {
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "");
  return cleaned.toLowerCase();
}

interface PopupWordData {
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

export const WordLookupModal = (props: {
  open: boolean;
  rawWord: string;
  sourceArticleId?: number;
  onClose: () => void;
}) => {
  const normalized = useMemo(() => normalizeWord(props.rawWord), [props.rawWord]);
  const [wordPopupPosition, setWordPopupPosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [showWordPopup, setShowWordPopup] = useState(false);
  const [notebooks, setNotebooks] = useState<VocabularyNotebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<number | "">("");

  useEffect(() => {
    if (!props.open) {
      setShowWordPopup(false);
      return;
    }

    const loadNotebooks = async () => {
      try {
        const res = await apiClient.get<VocabularyNotebook[]>("/vocabulary/notebooks");
        setNotebooks(res.data);
        const lastNotebookId = localStorage.getItem("lastNotebookId");
        if (lastNotebookId) {
          const parsedId = Number(lastNotebookId);
          const exists = res.data.find((notebook) => notebook.id === parsedId);
          if (exists) {
            setSelectedNotebook(parsedId);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadNotebooks();

    if (normalized) {
      setWordPopupPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      setShowWordPopup(true);
    }
  }, [props.open, normalized]);

  const handleAddWord = async (
    word: string,
    notebookId?: number,
    wordData?: PopupWordData,
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
        ? Object.entries(wordData.tags).filter(([, value]) => value).map(([key]) => key).join(" ")
        : undefined;

      await apiClient.post("/vocabulary", {
        word,
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
        source_article_id: props.sourceArticleId ?? null,
      });

      setShowWordPopup(false);
      localStorage.setItem("lastNotebookId", String(notebookId));
      props.onClose();
    } catch (err) {
      console.error(err);
      alert("添加生词失败");
    }
  };

  if (!props.open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={props.onClose}>
      {showWordPopup && (
        <LazyWordPopup
          word={normalized || props.rawWord}
          position={wordPopupPosition}
          onClose={props.onClose}
          onAddWord={handleAddWord}
          notebooks={notebooks}
          selectedNotebookId={selectedNotebook === "" ? undefined : selectedNotebook}
          onNotebookChange={setSelectedNotebook}
        />
      )}
    </div>
  );
};
