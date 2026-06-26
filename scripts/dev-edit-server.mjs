// Local-only dev helper: lets the web app save manual translation-line
// corrections straight to public/translations/<videoId>.json and creates a
// local git commit for each save. Never pushes — that stays a manual,
// reviewed step. Run alongside `npm run web` (this is NOT part of the
// published app — it's a dev tool you run on your own machine).
//
// Usage: node scripts/dev-edit-server.mjs

import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

const PORT = 5174;
const ROOT = path.resolve(import.meta.dirname, '..');
const TRANSLATIONS_DIR = path.join(ROOT, 'public', 'translations');
const LYRICS_DIR = path.join(ROOT, 'public', 'lyrics');
const WORDTIMING_DIR = path.join(ROOT, 'public', 'wordtiming');

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function isSafeVideoId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{6,20}$/.test(id);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true });
    return;
  }
  if (req.method === 'POST' && req.url === '/push') {
    execFile('git', ['push', 'origin', 'main'], { cwd: ROOT }, (pushErr, stdout, stderr) => {
      if (pushErr) {
        send(res, 200, { pushed: false, error: String(stderr || pushErr) });
        return;
      }
      send(res, 200, { pushed: true });
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/save-translation') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        send(res, 400, { error: 'invalid JSON' });
        return;
      }
      const { videoId, tag, text, track } = data || {};
      if (!isSafeVideoId(videoId) || typeof tag !== 'string' || typeof text !== 'string') {
        send(res, 400, { error: 'missing/invalid fields' });
        return;
      }
      const file = path.join(TRANSLATIONS_DIR, `${videoId}.json`);
      let json = {};
      try {
        json = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        // file may not exist yet for a song with no bundled translation
      }
      json[tag] = text;
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');

      const relPath = path.relative(ROOT, file);
      execFile('git', ['add', relPath], { cwd: ROOT }, (addErr) => {
        if (addErr) {
          send(res, 200, { saved: true, committed: false, error: String(addErr) });
          return;
        }
        const message = `Fix translation line in ${track || videoId} (${tag})`;
        execFile('git', ['commit', '-m', message], { cwd: ROOT }, (commitErr) => {
          if (commitErr) {
            // most likely "nothing to commit" if the text matched what was already there
            send(res, 200, { saved: true, committed: false, error: String(commitErr) });
            return;
          }
          send(res, 200, { saved: true, committed: true });
        });
      });
    });
    return;
  }

  // Move a word across the boundary between two adjacent lyric lines (e.g.
  // a caption split the line in the wrong place). Updates both lines' text
  // in the .lrc file in one commit.
  if (req.method === 'POST' && req.url === '/save-lyric-lines') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        send(res, 400, { error: 'invalid JSON' });
        return;
      }
      const { videoId, edits, wordTimingUpdate, track } = data || {};
      if (!isSafeVideoId(videoId) || !Array.isArray(edits) || !edits.length) {
        send(res, 400, { error: 'missing/invalid fields' });
        return;
      }
      const file = path.join(LYRICS_DIR, `${videoId}.lrc`);
      let raw;
      try {
        raw = fs.readFileSync(file, 'utf8');
      } catch {
        send(res, 400, { error: 'lyrics file not found' });
        return;
      }
      const lines = raw.split('\n');
      for (const { tag, text } of edits) {
        if (typeof tag !== 'string' || typeof text !== 'string') continue;
        const idx = lines.findIndex((l) => l.startsWith(`[${tag}]`));
        if (idx >= 0) lines[idx] = `[${tag}]${text}`;
      }
      fs.writeFileSync(file, lines.join('\n'), 'utf8');
      const relPaths = [path.relative(ROOT, file)];

      // The word's actual timestamp doesn't change when it moves to a
      // different line's text - just which line's array it's grouped
      // under - so the client computes the moved entry and we just write
      // both updated arrays, no re-alignment needed.
      if (wordTimingUpdate && typeof wordTimingUpdate === 'object') {
        const wtFile = path.join(WORDTIMING_DIR, `${videoId}.json`);
        let wt = {};
        try {
          wt = JSON.parse(fs.readFileSync(wtFile, 'utf8'));
        } catch {
          // no existing word-timing file for this song
        }
        for (const [tag, words] of Object.entries(wordTimingUpdate)) {
          if (Array.isArray(words)) wt[tag] = words;
        }
        fs.writeFileSync(wtFile, JSON.stringify(wt, null, 2) + '\n', 'utf8');
        relPaths.push(path.relative(ROOT, wtFile));
      }

      execFile('git', ['add', ...relPaths], { cwd: ROOT }, (addErr) => {
        if (addErr) {
          send(res, 200, { saved: true, committed: false, error: String(addErr) });
          return;
        }
        const tags = edits.map((e) => e.tag).join(', ');
        const message = `Adjust line boundary in ${track || videoId} (${tags})`;
        execFile('git', ['commit', '-m', message], { cwd: ROOT }, (commitErr) => {
          if (commitErr) {
            send(res, 200, { saved: true, committed: false, error: String(commitErr) });
            return;
          }
          send(res, 200, { saved: true, committed: true });
        });
      });
    });
    return;
  }

  // Shift when a line itself appears (not just the word-highlights inside
  // it) - renames its tag to a new timestamp across the .lrc, translation,
  // and word-timing files in one commit.
  if (req.method === 'POST' && req.url === '/shift-lyric-line') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        send(res, 400, { error: 'invalid JSON' });
        return;
      }
      const { videoId, oldTag, newTag, text, wordTimingUpdate, track } = data || {};
      if (
        !isSafeVideoId(videoId) ||
        typeof oldTag !== 'string' ||
        typeof newTag !== 'string' ||
        typeof text !== 'string'
      ) {
        send(res, 400, { error: 'missing/invalid fields' });
        return;
      }
      const lrcFile = path.join(LYRICS_DIR, `${videoId}.lrc`);
      let raw;
      try {
        raw = fs.readFileSync(lrcFile, 'utf8');
      } catch {
        send(res, 400, { error: 'lyrics file not found' });
        return;
      }
      const lrcLines = raw.split('\n').filter((l) => !l.startsWith(`[${oldTag}]`));
      const tagToMs = (t) => {
        const m = t.match(/^(\d+):(\d+(?:\.\d+)?)$/);
        return m ? (parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 1000 : 0;
      };
      const newMs = tagToMs(newTag);
      let insertAt = lrcLines.length;
      for (let i = 0; i < lrcLines.length; i++) {
        const m = lrcLines[i].match(/^\[(\d+:\d+(?:\.\d+)?)\]/);
        if (!m) continue;
        if (tagToMs(m[1]) > newMs) {
          insertAt = i;
          break;
        }
      }
      lrcLines.splice(insertAt, 0, `[${newTag}]${text}`);
      fs.writeFileSync(lrcFile, lrcLines.join('\n'), 'utf8');
      const relPaths = [path.relative(ROOT, lrcFile)];

      const trFile = path.join(TRANSLATIONS_DIR, `${videoId}.json`);
      try {
        const tr = JSON.parse(fs.readFileSync(trFile, 'utf8'));
        if (oldTag in tr) {
          tr[newTag] = tr[oldTag];
          delete tr[oldTag];
          fs.writeFileSync(trFile, JSON.stringify(tr, null, 2) + '\n', 'utf8');
          relPaths.push(path.relative(ROOT, trFile));
        }
      } catch {
        // no translation file for this song
      }

      const wtFile = path.join(WORDTIMING_DIR, `${videoId}.json`);
      try {
        const wt = JSON.parse(fs.readFileSync(wtFile, 'utf8'));
        delete wt[oldTag];
        if (wordTimingUpdate && Array.isArray(wordTimingUpdate)) wt[newTag] = wordTimingUpdate;
        fs.writeFileSync(wtFile, JSON.stringify(wt, null, 2) + '\n', 'utf8');
        relPaths.push(path.relative(ROOT, wtFile));
      } catch {
        // no word-timing file for this song
      }

      execFile('git', ['add', ...relPaths], { cwd: ROOT }, (addErr) => {
        if (addErr) {
          send(res, 200, { saved: true, committed: false, error: String(addErr) });
          return;
        }
        const message = `Shift line timing in ${track || videoId} (${oldTag} -> ${newTag})`;
        execFile('git', ['commit', '-m', message], { cwd: ROOT }, (commitErr) => {
          if (commitErr) {
            send(res, 200, { saved: true, committed: false, error: String(commitErr) });
            return;
          }
          send(res, 200, { saved: true, committed: true });
        });
      });
    });
    return;
  }

  // Remove a line entirely (e.g. a caption fragment that isn't real
  // lyrics). Removes it from the .lrc and cleans up its translation and
  // word-timing entries if present.
  if (req.method === 'POST' && req.url === '/delete-lyric-line') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        send(res, 400, { error: 'invalid JSON' });
        return;
      }
      const { videoId, tag, track } = data || {};
      if (!isSafeVideoId(videoId) || typeof tag !== 'string') {
        send(res, 400, { error: 'missing/invalid fields' });
        return;
      }
      const lrcFile = path.join(LYRICS_DIR, `${videoId}.lrc`);
      let raw;
      try {
        raw = fs.readFileSync(lrcFile, 'utf8');
      } catch {
        send(res, 400, { error: 'lyrics file not found' });
        return;
      }
      const lines = raw.split('\n').filter((l) => !l.startsWith(`[${tag}]`));
      fs.writeFileSync(lrcFile, lines.join('\n'), 'utf8');
      const relPaths = [path.relative(ROOT, lrcFile)];

      const trFile = path.join(TRANSLATIONS_DIR, `${videoId}.json`);
      try {
        const tr = JSON.parse(fs.readFileSync(trFile, 'utf8'));
        if (tag in tr) {
          delete tr[tag];
          fs.writeFileSync(trFile, JSON.stringify(tr, null, 2) + '\n', 'utf8');
          relPaths.push(path.relative(ROOT, trFile));
        }
      } catch {
        // no translation file for this song
      }

      const wtFile = path.join(WORDTIMING_DIR, `${videoId}.json`);
      try {
        const wt = JSON.parse(fs.readFileSync(wtFile, 'utf8'));
        if (tag in wt) {
          delete wt[tag];
          fs.writeFileSync(wtFile, JSON.stringify(wt, null, 2) + '\n', 'utf8');
          relPaths.push(path.relative(ROOT, wtFile));
        }
      } catch {
        // no word-timing file for this song
      }

      execFile('git', ['add', ...relPaths], { cwd: ROOT }, (addErr) => {
        if (addErr) {
          send(res, 200, { saved: true, committed: false, error: String(addErr) });
          return;
        }
        const message = `Remove line in ${track || videoId} (${tag})`;
        execFile('git', ['commit', '-m', message], { cwd: ROOT }, (commitErr) => {
          if (commitErr) {
            send(res, 200, { saved: true, committed: false, error: String(commitErr) });
            return;
          }
          send(res, 200, { saved: true, committed: true });
        });
      });
    });
    return;
  }

  // Wipe every line for a song entirely — text, translations, and
  // word-timing all reset to empty, so it can be rebuilt from scratch with
  // the "add missing line" tool. A deliberate full reset, not a per-line edit.
  if (req.method === 'POST' && req.url === '/clear-lyrics') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        send(res, 400, { error: 'invalid JSON' });
        return;
      }
      const { videoId, track } = data || {};
      if (!isSafeVideoId(videoId)) {
        send(res, 400, { error: 'missing/invalid fields' });
        return;
      }
      const lrcFile = path.join(LYRICS_DIR, `${videoId}.lrc`);
      if (!fs.existsSync(lrcFile)) {
        send(res, 400, { error: 'lyrics file not found' });
        return;
      }
      fs.writeFileSync(lrcFile, '', 'utf8');
      const relPaths = [path.relative(ROOT, lrcFile)];

      const trFile = path.join(TRANSLATIONS_DIR, `${videoId}.json`);
      if (fs.existsSync(trFile)) {
        fs.writeFileSync(trFile, '{}\n', 'utf8');
        relPaths.push(path.relative(ROOT, trFile));
      }

      const wtFile = path.join(WORDTIMING_DIR, `${videoId}.json`);
      if (fs.existsSync(wtFile)) {
        fs.writeFileSync(wtFile, '{}\n', 'utf8');
        relPaths.push(path.relative(ROOT, wtFile));
      }

      execFile('git', ['add', ...relPaths], { cwd: ROOT }, (addErr) => {
        if (addErr) {
          send(res, 200, { saved: true, committed: false, error: String(addErr) });
          return;
        }
        const message = `Clear all lines in ${track || videoId}`;
        execFile('git', ['commit', '-m', message], { cwd: ROOT }, (commitErr) => {
          if (commitErr) {
            send(res, 200, { saved: true, committed: false, error: String(commitErr) });
            return;
          }
          send(res, 200, { saved: true, committed: true });
        });
      });
    });
    return;
  }

  // Insert a brand-new lyric line at a given timestamp (e.g. the captions
  // skipped a sung phrase entirely). Inserts into the .lrc in chronological
  // order by tag.
  if (req.method === 'POST' && req.url === '/insert-lyric-line') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        send(res, 400, { error: 'invalid JSON' });
        return;
      }
      const { videoId, tag, text, wordTimingUpdate, track } = data || {};
      if (!isSafeVideoId(videoId) || typeof tag !== 'string' || typeof text !== 'string' || !text.trim()) {
        send(res, 400, { error: 'missing/invalid fields' });
        return;
      }
      const file = path.join(LYRICS_DIR, `${videoId}.lrc`);
      let raw;
      try {
        raw = fs.readFileSync(file, 'utf8');
      } catch {
        send(res, 400, { error: 'lyrics file not found' });
        return;
      }
      const lines = raw.split('\n');
      const newLine = `[${tag}]${text}`;
      const tagToMs = (t) => {
        const m = t.match(/^(\d+):(\d+(?:\.\d+)?)$/);
        return m ? (parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 1000 : 0;
      };
      const newMs = tagToMs(tag);
      let insertAt = lines.length;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^\[(\d+:\d+(?:\.\d+)?)\]/);
        if (!m) continue;
        if (tagToMs(m[1]) > newMs) {
          insertAt = i;
          break;
        }
      }
      lines.splice(insertAt, 0, newLine);
      fs.writeFileSync(file, lines.join('\n'), 'utf8');
      const relPaths = [path.relative(ROOT, file)];

      if (wordTimingUpdate && Array.isArray(wordTimingUpdate)) {
        const wtFile = path.join(WORDTIMING_DIR, `${videoId}.json`);
        try {
          const wt = JSON.parse(fs.readFileSync(wtFile, 'utf8'));
          wt[tag] = wordTimingUpdate;
          fs.writeFileSync(wtFile, JSON.stringify(wt, null, 2) + '\n', 'utf8');
          relPaths.push(path.relative(ROOT, wtFile));
        } catch {
          // no word-timing file for this song yet
        }
      }

      execFile('git', ['add', ...relPaths], { cwd: ROOT }, (addErr) => {
        if (addErr) {
          send(res, 200, { saved: true, committed: false, error: String(addErr) });
          return;
        }
        const message = `Add missing line in ${track || videoId} (${tag})`;
        execFile('git', ['commit', '-m', message], { cwd: ROOT }, (commitErr) => {
          if (commitErr) {
            send(res, 200, { saved: true, committed: false, error: String(commitErr) });
            return;
          }
          send(res, 200, { saved: true, committed: true });
        });
      });
    });
    return;
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`Dev edit server listening on http://localhost:${PORT}`);
  console.log('Saves write to public/translations/<id>.json and create a LOCAL commit only (never pushes).');
});
