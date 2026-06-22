import fs from 'fs';

const ids = [];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function translate(text) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=iw&dt=t&q=' + encodeURIComponent(text);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map((seg) => seg[0]).join('').replace(/[֑-ׇ]/g, '');
  }
  return null;
}

const cache = new Map();

for (const id of ids) {
  const lrc = fs.readFileSync(`public/lyrics/${id}.lrc`, 'utf8');
  const lines = [];
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/^\[(\d{2}:\d{2}\.\d{2})\](.*)$/);
    if (!m) continue;
    lines.push({ tag: m[1], text: m[2].trim() });
  }
  const out = {};
  for (const { tag, text } of lines) {
    if (!text) continue;
    // "¦" preserves a source caption's own line break (e.g. two lines shown
    // together) — translate each sub-line on its own so the Hebrew keeps
    // the same break, then rejoin with the same marker.
    const subs = text.split('¦');
    const trSubs = [];
    for (const sub of subs) {
      const key = sub.toLowerCase();
      if (cache.has(key)) {
        trSubs.push(cache.get(key));
        continue;
      }
      let tr = '';
      try {
        tr = (await translate(sub)) || '';
        cache.set(key, tr);
      } catch (e) {
        tr = '';
      }
      trSubs.push(tr);
      await sleep(120);
    }
    out[tag] = trSubs.join('¦');
  }
  fs.writeFileSync(`public/translations/${id}.json`, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(id, '->', Object.keys(out).length, 'lines translated');
}
