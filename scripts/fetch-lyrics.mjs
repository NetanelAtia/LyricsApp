// One-off helper: fetch synced lyrics from lrclib.net for a list of songs
// and save them to public/lyrics/<videoId>.lrc, matching the existing
// project convention. Run with: node scripts/fetch-lyrics.mjs
import fs from 'fs';
import path from 'path';

const songs = [
  { videoId: 'Xg72z08aTXY', artist: 'Maneskin', track: "Beggin'" },
  { videoId: 'YQHsXMglC9A', artist: 'Adele', track: 'Hello' },
  { videoId: 'eVTXPUF4Oz4', artist: 'Linkin Park', track: 'In The End' },
  { videoId: 'Zi_XLOBDo_Y', artist: 'Michael Jackson', track: 'Billie Jean' },
  { videoId: 'CaCSuzR4DwM', artist: 'Louis Armstrong', track: 'What A Wonderful World' },
  { videoId: '3AyMjyHu1bA', artist: 'Justin Bieber', track: 'Intentions' },
  { videoId: 'oyEuk8j8imI', artist: 'Justin Bieber', track: 'Love Yourself' },
  { videoId: 'H5v3kku4y6Q', artist: 'Harry Styles', track: 'As It Was' },
  { videoId: 'YaEG2aWJnZ8', artist: 'Sia', track: 'Unstoppable' },
  { videoId: 'fHI8X4OXluQ', artist: 'The Weeknd', track: 'Blinding Lights' },
];

const outDir = path.resolve('public/lyrics');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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
