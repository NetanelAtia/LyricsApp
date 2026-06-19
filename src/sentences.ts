// Saved full sentences/lines from songs — a parallel vocabulary store to
// single words (see vocab.ts), for learning whole phrases instead of just
// individual words. Stored in the browser (localStorage).

const KEY = 'lyricsapp:sentences';

export type SentenceItem = {
  id: string; // `${videoId}:${lrcTag}` — unique per song line
  text: string; // the English line
  translation: string; // its Hebrew translation
  song?: string;
  addedAt: number;
};

export function getSentences(): SentenceItem[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    }
  } catch {}
  return [];
}

function saveAll(list: SentenceItem[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage)
      window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function isSentenceSaved(id: string): boolean {
  return getSentences().some((s) => s.id === id);
}

export function removeSentence(id: string) {
  saveAll(getSentences().filter((s) => s.id !== id));
}

// Add or remove a sentence; returns the new saved state (true = now saved).
export function toggleSentence(id: string, text: string, translation: string, song?: string): boolean {
  const list = getSentences();
  if (list.some((s) => s.id === id)) {
    saveAll(list.filter((s) => s.id !== id));
    return false;
  }
  list.push({ id, text, translation, song, addedAt: Date.now() });
  saveAll(list);
  return true;
}
