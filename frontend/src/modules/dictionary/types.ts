export interface DictionaryEntry {
  word: string;
  lemma: string;
  phonetic?: string | null;
  uk_phonetic?: string | null;
  us_phonetic?: string | null;
  uk_audio?: string | null;
  us_audio?: string | null;
  pronunciation_url?: string | null;
  meanings: Array<{
    part_of_speech: string;
    definitions: string[];
    examples: string[];
  }>;
  chinese_translation?: string | null;
  english_definition?: string | null;
  synonyms: string[];
  sentences: Array<{ english: string; chinese: string }>;
  phrases: Array<{ phrase: string; translation: string }>;
  tags: Record<string, boolean>;
  collins?: number;
  oxford?: boolean;
  bnc?: number | null;
  frq?: number | null;
  source: string;
}
