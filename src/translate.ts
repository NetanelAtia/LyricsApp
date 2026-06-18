// Translate English -> Hebrew, with a PERSISTENT cache (localStorage on web).
// Once something is translated it's saved, so next time it's instant and
// works offline. Tries Google first (best quality), falls back to MyMemory.

const mem = new Map<string, string>();
const LS_PREFIX = 'lyricsapp:tr:';

function lsGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage)
      return window.localStorage.getItem(LS_PREFIX + key);
  } catch {}
  return null;
}
function lsSet(key: string, val: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage)
      window.localStorage.setItem(LS_PREFIX + key, val);
  } catch {}
}

async function googleTranslate(text: string): Promise<string | null> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=iw&dt=t&q=' +
    encodeURIComponent(text);
  const res = await fetch(url);
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map((seg: any) => seg[0]).join('');
  }
  return null;
}

async function myMemoryTranslate(text: string): Promise<string | null> {
  const res = await fetch(
    'https://api.mymemory.translated.net/get?langpair=en|he&q=' + encodeURIComponent(text)
  );
  const data = await res.json();
  return data?.responseData?.translatedText ?? null;
}

// Returns a cached translation instantly if we have one (no network at all).
export function cachedTranslation(text: string): string | null {
  const key = text.trim().toLowerCase();
  if (!key) return '';
  if (mem.has(key)) return mem.get(key)!;
  const ls = lsGet(key);
  if (ls) {
    mem.set(key, ls);
    return ls;
  }
  return null;
}

export async function translateToHebrew(text: string): Promise<string> {
  const key = text.trim().toLowerCase();
  if (!key) return '';

  const cached = cachedTranslation(text);
  if (cached) return cached;

  let result: string | null = null;
  try {
    result = await googleTranslate(text);
  } catch {}
  if (!result) {
    try {
      result = await myMemoryTranslate(text);
    } catch {}
  }

  const final = result || '—';
  mem.set(key, final);
  lsSet(key, final);
  return final;
}
