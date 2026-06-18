// Personal vocabulary: words the user saved to learn. Stored in the browser
// (localStorage) so it persists across visits.

const KEY = 'lyricsapp:vocab';

export type VocabWord = { word: string; translation: string; addedAt: number; song?: string };

export function getVocab(): VocabWord[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    }
  } catch {}
  return [];
}

function saveAll(list: VocabWord[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage)
      window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function isSaved(word: string): boolean {
  const w = word.toLowerCase();
  return getVocab().some((x) => x.word === w);
}

export function removeWord(word: string) {
  const w = word.toLowerCase();
  saveAll(getVocab().filter((x) => x.word !== w));
}

// Add or remove a word; returns the new saved state (true = now saved).
export function toggleWord(word: string, translation: string, song?: string): boolean {
  const w = word.toLowerCase();
  const list = getVocab();
  if (list.some((x) => x.word === w)) {
    saveAll(list.filter((x) => x.word !== w));
    return false;
  }
  list.push({ word: w, translation, addedAt: Date.now(), song });
  saveAll(list);
  return true;
}
