export interface DictionaryEntry {
  word: string;
  lemma: string;
  phonetic?: string | null;
  pronunciation_url?: string | null;
  meanings: Array<{
    part_of_speech: string;
    definitions: string[];
    examples: string[];
  }>;
  synonyms: string[];
  source: string;
}

