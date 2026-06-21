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
  if (req.method !== 'POST' || req.url !== '/save-translation') {
    send(res, 404, { error: 'not found' });
    return;
  }
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
});

server.listen(PORT, () => {
  console.log(`Dev edit server listening on http://localhost:${PORT}`);
  console.log('Saves write to public/translations/<id>.json and create a LOCAL commit only (never pushes).');
});
