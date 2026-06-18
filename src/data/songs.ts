// Sample content for building & testing the app.
// These are ORIGINAL simple lyrics written for learners (not copyrighted songs),
// so we can develop the whole "tap a word -> translation" engine freely.
// Later we'll swap this for real songs via a licensed API.

export type Song = {
  id: string;
  title: string;
  artist: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  emoji: string;
  accent: string; // cover color
  lines: string[];
  linesHe: string[]; // full Hebrew translation for each line (same order)
  // word (lowercase, no punctuation) -> Hebrew translation
  glossary: Record<string, string>;
};

export const songs: Song[] = [
  {
    id: 'morning-sun',
    title: 'Morning Sun',
    artist: 'LyricsApp Demo',
    difficulty: 'Easy',
    emoji: '🌅',
    accent: '#fd79a8',
    lines: [
      'The morning sun is rising slow',
      'I open up my eyes and go',
      'The sky is blue, the air is clear',
      'A brand new day is finally here',
    ],
    linesHe: [
      'שמש הבוקר עולה לאט',
      'אני פוקח את עיניי והולך',
      'השמיים כחולים, האוויר צלול',
      'יום חדש לגמרי סוף סוף הגיע',
    ],
    glossary: {
      morning: 'בוקר',
      sun: 'שמש',
      rising: 'עולה / זורח',
      slow: 'לאט',
      open: 'לפתוח',
      eyes: 'עיניים',
      sky: 'שמיים',
      blue: 'כחול',
      air: 'אוויר',
      clear: 'צלול / בהיר',
      brand: 'חדש לגמרי',
      new: 'חדש',
      day: 'יום',
      finally: 'סוף סוף',
      here: 'כאן',
    },
  },
  {
    id: 'city-lights',
    title: 'City Lights',
    artist: 'LyricsApp Demo',
    difficulty: 'Medium',
    emoji: '🌃',
    accent: '#6c5ce7',
    lines: [
      'The city lights are shining bright',
      'We walk together through the night',
      'A thousand dreams below the sky',
      'We laugh and watch the world go by',
    ],
    linesHe: [
      'אורות העיר זוהרים בבהירות',
      'אנחנו הולכים יחד לאורך הלילה',
      'אלף חלומות מתחת לשמיים',
      'אנחנו צוחקים ומביטים בעולם החולף',
    ],
    glossary: {
      city: 'עיר',
      lights: 'אורות',
      shining: 'זוהר / מאיר',
      bright: 'בהיר',
      walk: 'ללכת',
      together: 'יחד',
      through: 'דרך',
      night: 'לילה',
      thousand: 'אלף',
      dreams: 'חלומות',
      below: 'מתחת',
      sky: 'שמיים',
      laugh: 'לצחוק',
      watch: 'להביט / לצפות',
      world: 'עולם',
    },
  },
  {
    id: 'home-again',
    title: 'Home Again',
    artist: 'LyricsApp Demo',
    difficulty: 'Hard',
    emoji: '🏡',
    accent: '#00b894',
    lines: [
      'Across the ocean, far away',
      'I wandered lost for many a day',
      'But every road I chose to roam',
      'Was quietly leading me back home',
    ],
    linesHe: [
      'מעבר לאוקיינוס, הרחק',
      'נדדתי אבוד ימים רבים',
      'אבל כל דרך שבחרתי לשוטט בה',
      'הובילה אותי בשקט בחזרה הביתה',
    ],
    glossary: {
      across: 'מעבר ל',
      ocean: 'אוקיינוס',
      far: 'רחוק',
      away: 'הרחק',
      wandered: 'נדדתי',
      lost: 'אבוד',
      many: 'רבים',
      every: 'כל',
      road: 'דרך / כביש',
      chose: 'בחרתי',
      roam: 'לשוטט',
      quietly: 'בשקט',
      leading: 'מוביל',
      back: 'בחזרה',
      home: 'בית',
    },
  },
];

// Common little words shared across all songs (articles, pronouns, etc.).
// This makes sure EVERY word in a song has a translation.
export const commonWords: Record<string, string> = {
  the: 'ה (יידוע)',
  a: 'אחד / יחיד',
  an: 'אחד / יחיד',
  is: 'הוא / יש',
  are: 'הם / נמצאים',
  was: 'היה',
  and: 'ו... / וגם',
  but: 'אבל',
  i: 'אני',
  we: 'אנחנו',
  me: 'אותי / לי',
  my: 'שלי',
  you: 'אתה / את',
  it: 'זה',
  up: 'למעלה',
  go: 'ללכת / לזוז',
  by: 'ליד / על-ידי',
  to: 'אל / ל...',
  for: 'בשביל / עבור',
  day: 'יום',
};

// Helper: clean a word so we can look it up (lowercase, strip punctuation).
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, '');
}

// Find the translation for a word: check the song's own glossary first,
// then fall back to the shared common words.
export function translateWord(song: Song, rawWord: string): string | null {
  const clean = normalizeWord(rawWord);
  return song.glossary[clean] ?? commonWords[clean] ?? null;
}
