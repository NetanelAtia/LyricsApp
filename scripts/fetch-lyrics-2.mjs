import fs from 'fs';
import path from 'path';

const songs = [
  { videoId: 'r7qovpFAGrQ', artist: 'Lil Nas X', track: 'Old Town Road' },
  { videoId: 'xFYQQPAOz7Y', artist: 'Eminem', track: 'Lose Yourself' },
  { videoId: 'C7dPqrmDWxs', artist: 'Pharrell Williams', track: 'Happy' },
  { videoId: 'UXWFqxKU2qA', artist: 'Snoop Dogg', track: 'Vato' },
  { videoId: 'gl1aHhXnN1k', artist: 'Ariana Grande', track: 'thank u, next' },
];

const outDir = path.resolve('public/lyrics');
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

for (const s of songs) {
  try {
    const q = encodeURIComponent(`${s.track} ${s.artist}`);
    const res = await fetch(`https://lrclib.net/api/search?q=${q}`, {
      headers: { 'User-Agent': 'LyricsApp/1.0', Accept: 'application/json' },
    });
    const text = await res.text();
    const data = JSON.parse(text);
    const hit = Array.isArray(data) ? data.find((d) => d.syncedLyrics) : null;
    if (!hit) {
      console.log(`MISSING: ${s.artist} - ${s.track}`);
    } else {
      fs.writeFileSync(path.join(outDir, `${s.videoId}.lrc`), hit.syncedLyrics, 'utf8');
      console.log(`OK: ${s.artist} - ${s.track} -> ${s.videoId}.lrc (${hit.syncedLyrics.split('\n').length} lines)`);
    }
  } catch (e) {
    console.log(`ERROR: ${s.artist} - ${s.track} -> ${e.message}`);
  }
  await sleep(1500);
}
