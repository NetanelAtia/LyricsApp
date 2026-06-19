// Lightweight spaced-repetition weighting: words you get wrong more often
// should come up more often in the games, instead of pure random shuffling.
// Stored per-word in the browser (localStorage), separate from the vocab list
// itself so it survives even if a word's translation/source changes.

const KEY = 'lyricsapp:srs';

type Stats = Record<string, { wrong: number; right: number }>;

function load(): Stats {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    }
  } catch {}
  return {};
}
function save(s: Stats) {
  try {
    if (typeof window !== 'undefined' && window.localStorage)
      window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function recordResult(word: string, correct: boolean) {
  const s = load();
  const w = word.toLowerCase();
  if (!s[w]) s[w] = { wrong: 0, right: 0 };
  if (correct) s[w].right += 1;
  else s[w].wrong += 1;
  save(s);
}

// Higher weight = should be practiced more. Every wrong answer raises it a
// lot; every right answer brings it back down a bit, but never below a
// small floor so well-known words still occasionally show up.
export function weightOf(word: string): number {
  const st = load()[word.toLowerCase()];
  if (!st) return 1;
  return Math.max(0.3, 1 + st.wrong * 1.5 - st.right * 0.3);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick n items without replacement, biased towards higher-weight ones
// (Efraimidis-Spirakis weighted sampling).
export function weightedSample<T>(items: T[], n: number, getKey: (t: T) => string): T[] {
  const scored = items.map((it) => ({ it, key: Math.pow(Math.random(), 1 / weightOf(getKey(it))) }));
  scored.sort((a, b) => b.key - a.key);
  return scored.slice(0, n).map((s) => s.it);
}

// Build a practice queue where troublesome words repeat 2-3x and easy ones
// appear once, then shuffle the whole thing.
export function weightedQueue<T>(items: T[], getKey: (t: T) => string): T[] {
  const expanded: T[] = [];
  items.forEach((it) => {
    const repeats = Math.max(1, Math.min(3, Math.round(weightOf(getKey(it)))));
    for (let i = 0; i < repeats; i++) expanded.push(it);
  });
  return shuffle(expanded);
}
