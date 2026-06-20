import fs from 'fs';

const ids = [];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function translate(text) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=iw&dt=t&q=' + encodeURIComponent(text);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map((seg) => seg[0]).join('');
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
    const key = text.toLowerCase();
    if (cache.has(key)) {
      out[tag] = cache.get(key);
      continue;
    }
    try {
      const tr = await translate(text);
      out[tag] = tr || '';
      cache.set(key, out[tag]);
    } catch (e) {
      out[tag] = '';
    }
    await sleep(120);
  }
  fs.writeFileSync(`public/translations/${id}.json`, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(id, '->', Object.keys(out).length, 'lines translated');
}
