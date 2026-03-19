export interface VocabularyItem {
  id: number;
  word: string;
  lemma?: string | null;
  phonetic?: string | null;
  meanings_json?: string | null;
  pronunciation_url?: string | null;
  source_article_id?: number | null;
  source_sentence?: string | null;
  notebook_id?: number | null;
  added_at: string;
  familiarity_score: number;
  interval_days: number;
  next_review_at?: string | null;
  review_count: number;
  lapse_count: number;
  last_review_at?: string | null;
  status: string;
}

export interface VocabularyNotebook {
  id: number;
  name: string;
  note?: string | null;
  created_at: string;
  updated_at: string;
  word_count: number;
}

