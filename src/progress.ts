// Player progress: XP, level, accuracy, mastered words, and a daily streak.
// Stored in the browser (localStorage) so it persists.

const KEY = 'lyricsapp:progress';

export type Progress = {
  xp: number;
  correct: number;
  wrong: number;
  mastered: string[]; // unique words answered correctly at least once
  streak: number;
  lastActiveDate: string; // 'YYYY-MM-DD'
  todayXp: number;
};

const DEFAULT: Progress = {
  xp: 0,
  correct: 0,
  wrong: 0,
  mastered: [],
  streak: 0,
  lastActiveDate: '',
  todayXp: 0,
};

export const DAILY_GOAL = 50; // XP per day to keep the streak alive
export const XP_PER_LEVEL = 100;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

function load(): Progress {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(KEY);
      if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT };
}
function save(p: Progress) {
  try {
    if (typeof window !== 'undefined' && window.localStorage)
      window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

// Read progress for display (resets today's XP view on a new day).
export function getProgress(): Progress {
  const p = load();
  if (p.lastActiveDate !== todayStr()) return { ...p, todayXp: 0 };
  return p;
}

// Record a game answer: updates XP, accuracy, mastered words and the streak.
export function award(correct: boolean, xp: number, word?: string) {
  const p = load();
  const today = todayStr();

  // New active day -> roll the streak.
  if (p.lastActiveDate !== today) {
    p.streak = p.lastActiveDate === yesterdayStr() ? p.streak + 1 : 1;
    p.lastActiveDate = today;
    p.todayXp = 0;
  }

  if (correct) {
    p.correct += 1;
    p.xp += xp;
    p.todayXp += xp;
    if (word && !p.mastered.includes(word)) p.mastered.push(word);
  } else {
    p.wrong += 1;
  }
  save(p);
}

export function getLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}
export function xpIntoLevel(xp: number): number {
  return xp % XP_PER_LEVEL;
}
export function accuracy(p: Progress): number {
  const total = p.correct + p.wrong;
  return total === 0 ? 0 : Math.round((p.correct / total) * 100);
}
