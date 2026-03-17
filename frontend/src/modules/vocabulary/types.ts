export interface VocabularyItem {
  id: number;
  word: string;
  lemma?: string | null;
  phonetic?: string | null;
  meanings_json?: string | null;
  pronunciation_url?: string | null;
  source_article_id?: number | null;
  source_sentence?: string | null;
  added_at: string;
  familiarity_score: number;
  interval_days: number;
  next_review_at?: string | null;
  review_count: number;
  lapse_count: number;
  last_review_at?: string | null;
  status: string;
}

