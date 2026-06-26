import { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import YouTubePlayer from '../components/YouTubePlayer';
import { translateToHebrew, cachedTranslation } from '../translate';
import { fetchJson } from '../net';
import { isSaved, toggleWord } from '../vocab';
import { isSentenceSaved, toggleSentence } from '../sentences';
import { defaultOffsets } from '../data/library';
import { colors, fonts, radius, spacing } from '../theme';

const cleanWord = (w: string) => w.replace(/[^a-zA-Z']/g, '').toLowerCase();

// Show each line/translation slightly BEFORE it's sung, so it's easy to read ahead.
const LOOKAHEAD = 0.4; // seconds

// Per-song sync offset. A user's own saved calibration (localStorage) wins;
// otherwise we use the built-in default so everyone gets it aligned.
function loadOffset(id: string): number {
  try {
    const v = window.localStorage?.getItem('lyricsapp:offset:' + id);
    if (v != null) return parseFloat(v);
  } catch {}
  return defaultOffsets[id] ?? 0;
}
function saveOffset(id: string, o: number) {
  try {
    window.localStorage?.setItem('lyricsapp:offset:' + id, String(o));
  } catch {}
}

// Pull the 11-character video id out of any YouTube link (or a raw id).
function extractVideoId(input: string): string | null {
  const url = input.trim();
  const patterns = [/youtu\.be\/([\w-]{11})/, /[?&]v=([\w-]{11})/, /embed\/([\w-]{11})/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(url)) return url;
  return null;
}

type LrcLine = { time: number; text: string; tag: string };

// Turn an LRC string ("[00:12.50] words") into timed lines.
// `tag` is the exact "mm:ss.xx" string — used to key curated translations.
function parseLrc(lrc: string): LrcLine[] {
  const out: LrcLine[] = [];
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
    if (!m) continue;
    const time = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    // "¦" marks a forced line break preserved from the source caption's own
    // multi-line block (e.g. two lines shown together on screen) — turn it
    // back into a real newline so the renderer can stack them.
    const text = raw.replace(/\[.*?\]/g, '').trim().replace(/¦/g, '\n');
    out.push({ time, text, tag: `${m[1]}:${m[2]}` });
  }
  return out;
}

// Cache the fetched synced lyrics per video, so they load instantly / offline.
const LRC_KEY = 'lyricsapp:lrc:';
function loadLrcCache(id: string): LrcLine[] | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LRC_KEY + id);
      return raw ? JSON.parse(raw) : null;
    }
  } catch {}
  return null;
}
function saveLrcCache(id: string, lines: LrcLine[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage)
      window.localStorage.setItem(LRC_KEY + id, JSON.stringify(lines));
  } catch {}
}

export default function YouTubeScreen({ navigation, route }: any) {
  // A song can be passed in from the home screen (videoId/artist/track).
  const params = route?.params || {};
  const [link, setLink] = useState('');
  const [videoId, setVideoId] = useState<string | null>(params.videoId ?? null);
  const [error, setError] = useState('');

  const [artist, setArtist] = useState(params.artist ?? '');
  const [track, setTrack] = useState(params.track ?? '');
  const [lines, setLines] = useState<LrcLine[]>([]);
  // Starts true when we already know the track (came from the library),
  // so the "search lyrics" form never flashes before the auto-fetch below
  // has a chance to run.
  const [loading, setLoading] = useState(!!params.track);
  const [lrcError, setLrcError] = useState('');
  const [currentLine, setCurrentLine] = useState(-1);
  const [currentWord, setCurrentWord] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [syncOffset, setSyncOffset] = useState(0); // per-song sync correction

  // Load this song's saved sync offset.
  useEffect(() => {
    setSyncOffset(videoId ? loadOffset(videoId) : 0);
  }, [videoId]);

  function adjustOffset(delta: number) {
    const o = +(syncOffset + delta).toFixed(1);
    setSyncOffset(o);
    if (videoId) saveOffset(videoId, o);
  }

  // Manual numeric entry for the offset (typed value while editing).
  const [offsetText, setOffsetText] = useState('0.0');
  useEffect(() => {
    setOffsetText(syncOffset.toFixed(1));
  }, [syncOffset]);
  function applyOffsetText(text: string) {
    const n = parseFloat(text.replace(',', '.'));
    const o = Number.isFinite(n) ? +n.toFixed(1) : 0;
    setSyncOffset(o);
    setOffsetText(o.toFixed(1));
    if (videoId) saveOffset(videoId, o);
  }

  // Dev-only (desktop web) manual fix-up for a mistranslated line: edits the
  // bundled translation JSON on disk via a local helper server and commits
  // the change locally (never pushes — that stays a manual, reviewed step).
  // See scripts/dev-edit-server.mjs.
  const canEditTranslations = __DEV__ && Platform.OS === 'web';
  const [editingTag, setEditingTag] = useState<string | null>(null); // locks which line is being edited, so it can't drift if the song keeps playing
  const [editText, setEditText] = useState('');
  const [editStatus, setEditStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'pushed' | 'error'>('idle');
  const [editServerUp, setEditServerUp] = useState(false);

  // Poll the local helper server so it's obvious — before you even try to
  // edit a line — whether `npm run edit-server` is actually running.
  useEffect(() => {
    if (!canEditTranslations) return;
    let alive = true;
    function check() {
      fetch('http://localhost:5174/health')
        .then((r) => alive && setEditServerUp(r.ok))
        .catch(() => alive && setEditServerUp(false));
    }
    check();
    const id = setInterval(check, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [canEditTranslations]);

  function startEditingLine(tag: string, currentText: string) {
    playerRef.current?.pauseVideo?.();
    setEditingTag(tag);
    setEditText(currentText);
    setEditStatus('idle');
  }

  function stopEditingLine() {
    setEditingTag(null);
    playerRef.current?.playVideo?.();
  }

  // Dev-only: edit a line's English text directly (e.g. a caption typo or
  // mis-transcribed word) — reuses the same /save-lyric-lines endpoint the
  // word-move/speed tools already use, since that endpoint patches text by
  // tag regardless of who calls it.
  const [editingEnTag, setEditingEnTag] = useState<string | null>(null);
  const [editEnText, setEditEnText] = useState('');
  function startEditingEnLine(tag: string, currentText: string) {
    playerRef.current?.pauseVideo?.();
    setEditingEnTag(tag);
    setEditEnText(currentText);
  }
  function stopEditingEnLine() {
    setEditingEnTag(null);
    playerRef.current?.playVideo?.();
  }
  async function saveEnLineText(tag: string, text: string) {
    await saveLyricLineEdits([{ tag, text }]);
    stopEditingEnLine();
  }

  // Dev-only: fix a caption that split a sentence at the wrong word boundary
  // by nudging one word across the line break, then save both lines.
  const [moveStatus, setMoveStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  // Dev-only: insert a brand-new line at the current playback position, for
  // a sung phrase the captions missed entirely (no line at all to fix).
  const [addingLine, setAddingLine] = useState(false);
  const [addLineText, setAddLineText] = useState('');
  const [addLineStatus, setAddLineStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  function startAddingLine() {
    playerRef.current?.pauseVideo?.();
    setAddLineText('');
    setAddLineStatus('idle');
    setAddingLine(true);
  }

  function stopAddingLine() {
    setAddingLine(false);
    playerRef.current?.playVideo?.();
  }

  // Hover tooltips on web — explain what a button does without an actual
  // native title attribute (react-native-web doesn't forward `title` to
  // the DOM), so this tracks the hovered button's own label + cursor
  // position and renders one small floating bubble that follows it.
  const [tooltip, setTooltip] = useState<{ label: string; left: number; top: number } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showTip(e: any, label: string) {
    if (Platform.OS !== 'web') return;
    const target = e?.currentTarget;
    const rect = target?.getBoundingClientRect?.();
    if (!rect) return;
    // Estimate the bubble's own size from the label so it can be centered
    // numerically (left/top math) instead of relying on a CSS percentage
    // transform, which react-native-web doesn't reliably apply.
    const width = Math.min(220, label.length * 6.5 + 16);
    const height = 26;
    setTooltip({
      label,
      left: rect.left + rect.width / 2 - width / 2,
      top: rect.top - 8 - height,
    });
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(hideTip, 3000);
  }
  function hideTip() {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
    setTooltip(null);
  }

  // A rough default per-word duration for a freshly-added line, so it gets
  // SOME word timing right away (gives access to the ⏩/⏪ speed buttons
  // immediately) instead of forcing a separate ⏱ calibration step first.
  const DEFAULT_WORD_DURATION = 0.35;
  async function saveNewLine() {
    const text = addLineText.trim();
    if (!text) return;
    const t = Math.max(0, getTime() + syncOffset);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = (t % 60).toFixed(2).padStart(5, '0');
    const tag = `${mm}:${ss}`;
    const time = parseInt(mm, 10) * 60 + parseFloat(ss);
    const words = text.split(/\s+/).filter(Boolean);
    const wordTimingUpdate = words.map((word, i) => ({
      word,
      start: +(time + i * DEFAULT_WORD_DURATION).toFixed(3),
      end: +(time + (i + 1) * DEFAULT_WORD_DURATION).toFixed(3),
    }));
    setAddLineStatus('saving');
    try {
      const res = await fetch('http://localhost:5174/insert-lyric-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, tag, text, wordTimingUpdate, track }),
      });
      if (!res.ok) throw new Error('save failed');
      setLines((prev) => {
        const next = [...prev, { time, text, tag }];
        next.sort((a, b) => a.time - b.time);
        return next;
      });
      setWordTiming((prev) => ({ ...prev, [tag]: wordTimingUpdate }));
      const tr = await translateToHebrew(text);
      await saveLineTranslation(tag, tr);
      setAddLineStatus('idle');
      stopAddingLine();
    } catch {
      setAddLineStatus('error');
    }
  }

  // Dev-only: delete a line entirely (e.g. a caption fragment that isn't
  // real lyrics).
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  async function deleteLine(tag: string) {
    setDeleteStatus('saving');
    try {
      const res = await fetch('http://localhost:5174/delete-lyric-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, tag, track }),
      });
      if (!res.ok) throw new Error('delete failed');
      setLines((prev) => prev.filter((l) => l.tag !== tag));
      setBundledTr((prev) => {
        const next = { ...prev };
        delete next[tag];
        return next;
      });
      setWordTiming((prev) => {
        const next = { ...prev };
        delete next[tag];
        return next;
      });
      setDeleteStatus('idle');
    } catch {
      setDeleteStatus('error');
    }
  }

  // Dev-only: wipe every line for this song (text, translation, timing —
  // everything), so it can be rebuilt from scratch with "add missing line".
  // A deliberate, confirmed full reset, not a per-line action.
  const [clearStatus, setClearStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  async function clearAllLines() {
    if (typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(`למחוק את כל המשפטים, התרגומים והתזמון של "${track}"? לא ניתן לבטל מהממשק.`);
      if (!ok) return;
    }
    setClearStatus('saving');
    try {
      const res = await fetch('http://localhost:5174/clear-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, track }),
      });
      if (!res.ok) throw new Error('clear failed');
      setLines([]);
      setBundledTr({});
      setWordTiming({});
      setClearStatus('idle');
    } catch {
      setClearStatus('error');
    }
  }

  async function saveLyricLineEdits(
    edits: { tag: string; text: string }[],
    wordTimingUpdate?: Record<string, { word: string; start: number; end: number }[]>
  ) {
    setMoveStatus('saving');
    try {
      const res = await fetch('http://localhost:5174/save-lyric-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, edits, wordTimingUpdate, track }),
      });
      if (!res.ok) throw new Error('save failed');
      setLines((prev) => {
        const next = prev.map((l) => ({ ...l }));
        for (const { tag, text } of edits) {
          const i = next.findIndex((l) => l.tag === tag);
          if (i >= 0) next[i].text = text;
        }
        return next;
      });
      if (wordTimingUpdate) {
        setWordTiming((prev) => ({ ...prev, ...wordTimingUpdate }));
      }
      setMoveStatus('idle');
    } catch {
      setMoveStatus('error');
    }
  }

  // Move when the whole line itself appears (not just the word-by-word
  // highlight inside it) a few seconds earlier or later - for a line
  // that's simply timed wrong from the start, not just sung at an
  // unexpected pace. Renames the line's tag, carrying its translation and
  // any word-timing (also shifted by the same amount) along with it.
  const LINE_SHIFT_STEP = 0.25;
  async function shiftLineTime(idx: number, deltaSeconds: number) {
    const cur = lines[idx];
    if (!cur) return;
    const newTime = Math.max(0, cur.time + deltaSeconds);
    const mm = String(Math.floor(newTime / 60)).padStart(2, '0');
    const ss = (newTime % 60).toFixed(2).padStart(5, '0');
    const newTag = `${mm}:${ss}`;
    if (newTag === cur.tag) return;
    const oldWordTiming = wordTiming[cur.tag];
    const shiftedWordTiming = oldWordTiming
      ? oldWordTiming.map((w) => ({ ...w, start: Math.max(0, w.start + deltaSeconds), end: Math.max(0, w.end + deltaSeconds) }))
      : undefined;
    setMoveStatus('saving');
    try {
      const res = await fetch('http://localhost:5174/shift-lyric-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, oldTag: cur.tag, newTag, text: cur.text, wordTimingUpdate: shiftedWordTiming, track }),
      });
      if (!res.ok) throw new Error('shift failed');
      setLines((prev) => {
        const next = prev.filter((l) => l.tag !== cur.tag);
        next.push({ time: newTime, text: cur.text, tag: newTag });
        next.sort((a, b) => a.time - b.time);
        return next;
      });
      setBundledTr((prev) => {
        const next = { ...prev };
        if (cur.tag in next) {
          next[newTag] = next[cur.tag];
          delete next[cur.tag];
        }
        return next;
      });
      setWordTiming((prev) => {
        const next = { ...prev };
        delete next[cur.tag];
        if (shiftedWordTiming) next[newTag] = shiftedWordTiming;
        return next;
      });
      setMoveStatus('idle');
    } catch {
      setMoveStatus('error');
    }
  }

  // Nudge the current line's word-highlight timing earlier or later, for
  // fine-tuning after the rough estimate (or a one-shot calibration) isn't
  // quite right. Shifts every word's start/end by a fixed step in the given
  // direction, clamped so words can't overlap or go negative.
  const SPEED_STEP = 0.15;
  async function nudgeCurrentLineTiming(idx: number, direction: 1 | -1) {
    const cur = lines[idx];
    if (!cur || !cur.text) return;
    // A line with no timing yet (e.g. one added manually) gets a rough
    // evenly-spaced starting point on the fly, so the nudge buttons work
    // immediately without forcing a separate ⏱ calibration step first.
    const curWordTiming =
      wordTiming[cur.tag] && wordTiming[cur.tag].length
        ? wordTiming[cur.tag]
        : cur.text.split(/\s+/).filter(Boolean).map((word, i) => ({
            word,
            start: +(cur.time + i * DEFAULT_WORD_DURATION).toFixed(3),
            end: +(cur.time + (i + 1) * DEFAULT_WORD_DURATION).toFixed(3),
          }));
    if (!curWordTiming.length) return;
    const delta = direction * SPEED_STEP;
    let shifted;
    if (direction < 0) {
      shifted = curWordTiming.map((w, i) => {
        const prevEnd = i > 0 ? curWordTiming[i - 1].end + delta : 0;
        const start = Math.max(0, prevEnd, w.start + delta);
        const duration = w.end - w.start;
        return { ...w, start, end: start + duration };
      });
    } else {
      shifted = [...curWordTiming];
      for (let i = shifted.length - 1; i >= 0; i--) {
        const nextStart = i < shifted.length - 1 ? shifted[i + 1].start - delta : Infinity;
        const start = Math.min(nextStart, shifted[i].start + delta);
        const duration = shifted[i].end - shifted[i].start;
        shifted[i] = { ...shifted[i], start, end: start + duration };
      }
    }
    const wordTimingUpdate = { [cur.tag]: shifted };
    await saveLyricLineEdits([{ tag: cur.tag, text: cur.text }], wordTimingUpdate);
  }

  // For a line with no word-timing at all (e.g. one added manually), give
  // it real timing in one step: press this the moment the line finishes
  // being sung, and the words get spread evenly across however long that
  // actually took, instead of falling back to the generic estimate.
  async function calibrateLineSpeed(idx: number) {
    const cur = lines[idx];
    if (!cur || !cur.text) return;
    const words = cur.text.split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const elapsed = Math.max(0.3, getTime() + syncOffset - cur.time);
    const perWord = elapsed / words.length;
    const generated = words.map((word, i) => ({
      word,
      start: +(cur.time + i * perWord).toFixed(3),
      end: +(cur.time + (i + 1) * perWord).toFixed(3),
    }));
    await saveLyricLineEdits([{ tag: cur.tag, text: cur.text }], { [cur.tag]: generated });
  }

  // Nudge a single word's highlight timing earlier/later, independent of
  // the rest of the line — for when only one word in an otherwise-correct
  // line feels off. Clamped so it can't cross into the neighboring words.
  async function nudgeSingleWord(tag: string, text: string, wordIdx: number, direction: 1 | -1) {
    const curWordTiming = wordTiming[tag];
    if (!curWordTiming || !curWordTiming[wordIdx]) return;
    const delta = direction * 0.15;
    const w = curWordTiming[wordIdx];
    const duration = w.end - w.start;
    // Deliberately NOT clamped against the neighboring words' own start/end —
    // back-to-back aligned words usually touch with zero gap, so clamping to
    // "don't cross the neighbor" left no room to move at all.
    const start = Math.max(0, w.start + delta);
    const updated = [...curWordTiming];
    updated[wordIdx] = { ...w, start, end: start + duration };
    await saveLyricLineEdits([{ tag, text }], { [tag]: updated });
  }

  // Type the exact second directly under a word instead of nudging by a
  // fixed step. Starts from whatever timing already exists (or the same
  // rough default used elsewhere) and lets you override any single word.
  async function setWordStartTime(tag: string, text: string, wordIdx: number, value: string) {
    const start = parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(start) || start < 0) return;
    const words = text.split(/\s+/).filter(Boolean);
    const lineStart = lines.find((l) => l.tag === tag)?.time ?? 0;
    const existing = wordTiming[tag];
    const base =
      existing && existing.length === words.length
        ? existing
        : words.map((word, i) => ({
            word,
            start: +(lineStart + i * DEFAULT_WORD_DURATION).toFixed(3),
            end: +(lineStart + (i + 1) * DEFAULT_WORD_DURATION).toFixed(3),
          }));
    const updated = [...base];
    const duration = updated[wordIdx].end - updated[wordIdx].start;
    updated[wordIdx] = { ...updated[wordIdx], start, end: start + duration };
    await saveLyricLineEdits([{ tag, text }], { [tag]: updated });
  }

  async function saveLineTranslation(tag: string, text: string) {
    setEditStatus('saving');
    try {
      const res = await fetch('http://localhost:5174/save-translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, tag, text, track }),
      });
      if (!res.ok) throw new Error('save failed');
      setBundledTr((prev) => ({ ...prev, [tag]: text }));
      setEditStatus('saved');
    } catch {
      setEditStatus('error');
    }
  }

  async function pushAllChanges() {
    setPushStatus('pushing');
    try {
      const res = await fetch('http://localhost:5174/push', { method: 'POST' });
      if (!res.ok) throw new Error('push failed');
      setPushStatus('pushed');
    } catch {
      setPushStatus('error');
    }
  }

  // One-tap calibration: press exactly when the first line is sung, and we
  // align the whole song to that moment.
  function calibrate() {
    const fi = lines.findIndex((l) => l.text);
    if (fi < 0) return;
    const o = +(lines[fi].time - getTime() - LOOKAHEAD).toFixed(1);
    setSyncOffset(o);
    if (videoId) saveOffset(videoId, o);
  }

  // Tapped word -> translation bubble.
  const [selected, setSelected] = useState<string | null>(null); // "line-word" key
  const [wordTranslation, setWordTranslation] = useState('');
  const [selectedWord, setSelectedWord] = useState(''); // clean tapped word
  const [selectedSaved, setSelectedSaved] = useState(false); // is it in vocab
  const [sentenceTick, setSentenceTick] = useState(0); // bumped to re-render after saving a sentence
  // Live-translated lines (lazily fetched), keyed by line index.
  const [lineTranslations, setLineTranslations] = useState<Record<number, string>>({});
  // While in English-only mode, a per-line override to reveal just one
  // line's translation on demand (the 🌐 button).
  const [openLines, setOpenLines] = useState<Record<number, boolean>>({});
  // 'both' keeps the existing English-with-optional-translation behavior;
  // 'en'/'he' show only one language.
  const [displayMode, setDisplayMode] = useState<'both' | 'en' | 'he'>('both');
  // Karaoke word-by-word highlight — on by default, can be turned off if
  // you'd rather just read the lyrics without the follow-along marking.
  const [karaokeOn, setKaraokeOn] = useState(true);
  // High-quality curated translations bundled with the app (time -> Hebrew).
  const [bundledTr, setBundledTr] = useState<Record<string, string>>({});
  // Real per-word timestamps from offline forced alignment, keyed by LRC
  // tag, when available for this song (see scripts/align).
  const [wordTiming, setWordTiming] = useState<Record<string, { word: string; start: number; end: number }[]>>({});
  // Curated per-word dictionary (word -> accurate Hebrew) for tapped words.
  const [glossary, setGlossary] = useState<Record<string, string>>({});

  // Load the curated word dictionary once.
  useEffect(() => {
    let alive = true;
    fetch('glossary.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => alive && setGlossary(j || {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // The best Hebrew for a line: curated first, then live auto-translation.
  function lineHe(i: number): string {
    const key = lines[i]?.tag;
    const tr = (key && bundledTr[key]) || lineTranslations[i] || '...';
    return tr.replace(/¦/g, '\n');
  }

  const playerRef = useRef<any>(null);

  const getTime = () => playerRef.current?.getCurrentTime?.() ?? 0;

  // Jump backward/forward by `delta` seconds.
  function seek(delta: number) {
    const t = getTime();
    playerRef.current?.seekTo?.(Math.max(0, t + delta), true);
  }

  // Pause / resume the song.
  function togglePlay() {
    if (isPlaying) playerRef.current?.pauseVideo?.();
    else playerRef.current?.playVideo?.();
  }

  // Keyboard control on web: ← / → seek 5 seconds (ignored while typing).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') seek(5);
      else if (e.key === 'ArrowLeft') seek(-5);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoId]);

  // Close the bubble and resume the song.
  function closeBubble() {
    setSelected(null);
    playerRef.current?.playVideo?.();
  }

  // Tap a word: pause the song and show its Hebrew translation in a bubble.
  async function onWordPress(key: string, word: string) {
    if (selected === key) {
      closeBubble();
      return;
    }
    const w = cleanWord(word);
    setSelected(key);
    setSelectedWord(w);
    setSelectedSaved(isSaved(w));
    playerRef.current?.pauseVideo?.();
    // Accurate curated dictionary first; then cache; then live translation.
    if (glossary[w]) {
      setWordTranslation(glossary[w]);
      return;
    }
    const cached = cachedTranslation(w);
    setWordTranslation(cached ?? '...');
    if (!cached) {
      const tr = await translateToHebrew(w);
      setWordTranslation(tr);
    }
  }

  // Save / remove the tapped word from the personal vocabulary.
  async function toggleSaveWord() {
    let tr = glossary[selectedWord] || wordTranslation;
    if (!tr || tr === '...') tr = await translateToHebrew(selectedWord);
    setSelectedSaved(toggleWord(selectedWord, tr, track || undefined));
  }

  // Reveal (or hide) just this one line's translation — used in
  // English-only mode, where the Hebrew slot is otherwise hidden.
  // Opening it pauses the song (so you have time to read); closing it
  // resumes playback.
  async function toggleLine(i: number, text: string) {
    const willOpen = !openLines[i];
    setOpenLines((prev) => ({ ...prev, [i]: willOpen }));
    if (willOpen) playerRef.current?.pauseVideo?.();
    else playerRef.current?.playVideo?.();
    const key = lines[i]?.tag;
    if (!(key && bundledTr[key]) && !lineTranslations[i]) {
      const tr = await translateToHebrew(text);
      setLineTranslations((prev) => ({ ...prev, [i]: tr }));
    }
  }

  function loadVideo() {
    const id = extractVideoId(link);
    if (!id) {
      setError('לא זוהה קישור יוטיוב תקין.');
      return;
    }
    setError('');
    setLines([]);
    setLrcError('');
    setVideoId(id);
  }

  // Paste the clipboard straight into the link field — and if it's already
  // a valid YouTube link, load it right away.
  async function pasteLink() {
    const text = await Clipboard.getStringAsync();
    if (!text) return;
    setLink(text);
    const id = extractVideoId(text);
    if (id) {
      setError('');
      setLines([]);
      setLrcError('');
      setVideoId(id);
    }
  }

  // Go back to the setup screen to pick a different song.
  function resetSong() {
    playerRef.current?.pauseVideo?.();
    setVideoId(null);
    setLines([]);
    setLink('');
    setArtist('');
    setTrack('');
    setSelected(null);
    setOpenLines({});
    setCurrentLine(-1);
    setLrcError('');
  }

  // We already auto-fetch immediately on mount when the track is known
  // (came from the library); only derive it from the video title here for
  // the paste-a-link flow, where it isn't known yet.
  function onPlayerReady(player: any) {
    playerRef.current = player;
    if (track) {
      // Lyrics were already fetched (or are in flight) by the mount effect
      // below; the player just wasn't ready yet to actually start playing.
      player.playVideo?.();
      return;
    }
    let artistVal = '';
    let trackVal = '';
    try {
      const data = player.getVideoData?.();
      const title: string = data?.title || '';
      // Titles look like "Artist - Track" or "Artist | Track (extra)".
      // Split on the first separator (-, |, –, —, •, :) surrounded by spaces.
      const clean = title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
      const parts = clean.split(/\s[-|–—•:]\s/);
      if (parts.length >= 2) {
        artistVal = parts[0].trim();
        trackVal = parts.slice(1).join(' ').trim();
      } else {
        trackVal = clean;
      }
    } catch {}
    setArtist(artistVal);
    setTrack(trackVal);
    if (trackVal) fetchLyrics(artistVal, trackVal);
  }

  // Came from the library with a known track — fetch its lyrics right away
  // instead of waiting for the YouTube player to report ready, so the
  // "search lyrics" setup screen never flashes first.
  useEffect(() => {
    if (params.track) fetchLyrics(params.artist ?? '', params.track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Translate every line in the background so translations are instant later.
  async function preTranslateLines(ls: LrcLine[]) {
    for (let i = 0; i < ls.length; i++) {
      if (!ls[i].text) continue;
      const tr = await translateToHebrew(ls[i].text);
      setLineTranslations((prev) => (prev[i] ? prev : { ...prev, [i]: tr }));
    }
  }

  // Get synced lyrics: from the offline cache if we have them, else from LRCLIB.
  async function fetchLyrics(a = artist, t = track) {
    setLoading(true);
    setLrcError('');
    setLines([]);

    // 0) Built-in lyrics bundled with the app (public/lyrics/<videoId>.lrc).
    //    Served from our own site — fast and reliable, no external network.
    if (videoId) {
      try {
        const res = await fetch(`lyrics/${videoId}.lrc`);
        if (res.ok) {
          const parsed = parseLrc(await res.text());
          if (parsed.length) {
            setLines(parsed);
            saveLrcCache(videoId, parsed);
            playerRef.current?.playVideo?.();
            preTranslateLines(parsed);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    // 1) Offline cache (instant, no network).
    if (videoId) {
      const cached = loadLrcCache(videoId);
      if (cached && cached.length) {
        setLines(cached);
        playerRef.current?.playVideo?.();
        preTranslateLines(cached);
        setLoading(false);
        return;
      }
    }

    // 2) Fetch from LRCLIB and save for next time.
    try {
      const q = encodeURIComponent(`${t} ${a}`.trim());
      const data = await fetchJson(`https://lrclib.net/api/search?q=${q}`);
      const hit = Array.isArray(data) ? data.find((d: any) => d.syncedLyrics) : null;
      if (!hit) {
        setLrcError('השיר לא נמצא במאגר המובנה. אפשר להוסיף אותו לתיקיית lyrics.');
      } else {
        const parsed = parseLrc(hit.syncedLyrics);
        setLines(parsed);
        if (videoId) saveLrcCache(videoId, parsed);
        playerRef.current?.playVideo?.();
        preTranslateLines(parsed); // translate all lines ahead of time
      }
    } catch {
      setLrcError('השיר לא נמצא במאגר המובנה (והחיפוש החי נכשל).');
    }
    setLoading(false);
  }

  // Whenever the translation is visible ("both" or "he" mode), fetch the
  // current line's translation automatically as the song moves along.
  useEffect(() => {
    if (displayMode === 'en') return;
    const idx = currentLine < 0 ? 0 : currentLine;
    const cur = lines[idx];
    const key = cur?.tag;
    if (cur && cur.text && !(key && bundledTr[key]) && !lineTranslations[idx]) {
      translateToHebrew(cur.text).then((tr) =>
        setLineTranslations((prev) => ({ ...prev, [idx]: tr }))
      );
    }
  }, [displayMode, currentLine, lines, bundledTr]);

  // Load the curated translations file for this song (if it exists).
  useEffect(() => {
    if (!videoId) {
      setBundledTr({});
      return;
    }
    let alive = true;
    fetch(`translations/${videoId}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => alive && setBundledTr(j || {}))
      .catch(() => alive && setBundledTr({}));
    return () => {
      alive = false;
    };
  }, [videoId]);

  // Exact, force-aligned word timestamps for this song, if we have them
  // (public/wordtiming/<videoId>.json) — generated offline from a real
  // audio file via scripts/align. When present, these replace the
  // estimated per-word timing below for a perfectly synced highlight.
  useEffect(() => {
    if (!videoId) {
      setWordTiming({});
      return;
    }
    let alive = true;
    fetch(`wordtiming/${videoId}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => alive && setWordTiming(j || {}))
      .catch(() => alive && setWordTiming({}));
    return () => {
      alive = false;
    };
  }, [videoId]);

  // Follow the video time and highlight the matching line.
  useEffect(() => {
    if (lines.length === 0) return;
    const id = setInterval(() => {
      const t = getTime() + LOOKAHEAD + syncOffset;
      let idx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= t) idx = i;
      }
      setCurrentLine(idx);
      setIsPlaying(playerRef.current?.getPlayerState?.() === 1);

      // Figure out which word inside the current line is being sung. We only
      // know the line's start/end time (not each word's), so this is an
      // estimate: give longer words a proportionally bigger time slice
      // (singers tend to linger on them) instead of splitting the line
      // evenly — that approximation is the main source of any residual lag
      // when someone sings a line slower than usual; without real per-word
      // timestamps there's no way to track that perfectly.
      if (idx >= 0 && lines[idx].text) {
        const words = lines[idx].text.split(/\s+/);
        const lineStart = lines[idx].time;
        const lineEnd = lines[idx + 1]?.time ?? lineStart + 4;
        const duration = lineEnd - lineStart;
        const now = getTime() + syncOffset;

        const exact = wordTiming[lines[idx].tag];
        if (exact && exact.length === words.length) {
          // Real per-word timestamps from forced alignment (scripts/align)
          // — the last word whose start has already passed, with a small
          // lead so the highlight lights up just before it's sung rather
          // than exactly on it.
          const exactLookahead = 0.4;
          const wi = exact.reduce((best, w, i) => (now + exactLookahead >= w.start ? i : best), 0);
          setCurrentWord(wi);
          return;
        }

        // Fallback estimate: divide the line's duration across its words,
        // weighting longer words with proportionally more time (singers
        // tend to linger on them). This is the main source of any residual
        // lag/overshoot when there's no exact alignment data for a song.
        const weights = words.map((w) => 140 + w.replace(/[^a-zA-Z']/g, '').length * 60);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let acc = 0;
        const boundaries = weights.map((w) => (acc += w, (acc / totalWeight) * duration));

        // The lookahead scales with how fast the words go by: on a fast
        // song each word is on screen briefly, so a small lead keeps it
        // from racing ahead of the singing; on a slow song each word lasts
        // much longer, so it can afford (and needs) a longer lead to avoid
        // lagging behind. Built directly off the raw time (not `t`, which
        // already carries the separate line-level LOOKAHEAD) — stacking
        // both was the main reason fast songs overshot so badly.
        const avgWordDuration = duration / words.length;
        const lookahead = Math.min(1.3, avgWordDuration * 1.1);
        const elapsed = now + lookahead - lineStart;
        let wi = boundaries.findIndex((b) => elapsed < b);
        if (wi === -1) wi = words.length - 1;
        setCurrentWord(wi);
      } else {
        setCurrentWord(-1);
      }
    }, 120);
    return () => clearInterval(id);
  }, [lines, syncOffset, wordTiming]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ חזור</Text>
        </TouchableOpacity>
        {lines.length > 0 && (
          <TouchableOpacity onPress={resetSong} hitSlop={12}>
            <Text style={styles.back}>🔄 שיר חדש</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
        {lines.length === 0 && <Text style={styles.title}>🎬 YouTube Karaoke</Text>}

        {/* Link input (only when no song chosen yet) */}
        {!videoId && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="הדבק קישור יוטיוב..."
              placeholderTextColor={colors.textFaint}
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.smallBtn} onPress={pasteLink} activeOpacity={0.85}>
              <Text style={styles.smallBtnText}>הדבק</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={loadVideo} activeOpacity={0.85}>
              <Text style={styles.smallBtnText}>טען</Text>
            </TouchableOpacity>
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Player */}
        {videoId && (
          <View style={styles.playerWrap}>
            {(artist || track) && (
              <Text style={styles.nowPlaying} numberOfLines={1}>
                {track}{artist ? ` — ${artist}` : ''}
              </Text>
            )}
            <YouTubePlayer videoId={videoId} onReady={onPlayerReady} />
          </View>
        )}

        {/* While the auto-fetch (for a song opened from the library) is
            still in flight, show nothing rather than flashing the manual
            search form first. */}
        {videoId && lines.length === 0 && loading && (
          <ActivityIndicator color={colors.primarySoft} style={{ marginTop: spacing.xl }} />
        )}

        {/* Find synced lyrics (setup only) */}
        {videoId && lines.length === 0 && !loading && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>מציאת מילים מסונכרנות אוטומטית</Text>
            <View style={styles.metaRow}>
              <TextInput
                style={styles.metaInput}
                placeholder="אמן"
                placeholderTextColor={colors.textFaint}
                value={artist}
                onChangeText={setArtist}
              />
              <TextInput
                style={styles.metaInput}
                placeholder="שם השיר"
                placeholderTextColor={colors.textFaint}
                value={track}
                onChangeText={setTrack}
              />
            </View>
            <TouchableOpacity style={styles.bigBtn} onPress={() => fetchLyrics()} activeOpacity={0.85}>
              <Text style={styles.bigBtnText}>🔍 חפש מילים מסונכרנות</Text>
            </TouchableOpacity>
            {loading && <ActivityIndicator color={colors.primarySoft} style={{ marginTop: spacing.md }} />}
            {lrcError ? <Text style={styles.error}>{lrcError}</Text> : null}
          </View>
        )}

        {/* Language display mode — English only / both / Hebrew only */}
        {lines.length > 0 && (
          <View style={styles.langModeRow}>
            <TouchableOpacity
              style={[styles.langModeBtn, displayMode === 'en' && styles.langModeBtnActive]}
              onPress={() => setDisplayMode('en')}
              activeOpacity={0.85}
            >
              <Text style={[styles.langModeText, displayMode === 'en' && styles.langModeTextActive]}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langModeBtn, displayMode === 'both' && styles.langModeBtnActive]}
              onPress={() => setDisplayMode('both')}
              activeOpacity={0.85}
            >
              <Text style={[styles.langModeText, displayMode === 'both' && styles.langModeTextActive]}>שניהם</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langModeBtn, displayMode === 'he' && styles.langModeBtnActive]}
              onPress={() => setDisplayMode('he')}
              activeOpacity={0.85}
            >
              <Text style={[styles.langModeText, displayMode === 'he' && styles.langModeTextActive]}>עברית</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Karaoke word-by-word highlight on/off */}
        {lines.length > 0 && (
          <View {...({ onMouseEnter: (e: any) => showTip(e, 'הדלק/כבה הדגשת מילה-מילה בזמן שירה'), onMouseLeave: hideTip } as any)}><TouchableOpacity
            style={[styles.karaokeToggle, karaokeOn && styles.karaokeToggleActive]}
            onPress={() => setKaraokeOn((v) => !v)}
            activeOpacity={0.85} 
          >
            <Text style={[styles.karaokeToggleText, karaokeOn && styles.karaokeToggleTextActive]}>
              {karaokeOn ? '🎤 מצב קריוקי פעיל' : '🎤 מצב קריוקי כבוי'}
            </Text>
          </TouchableOpacity></View>
        )}
        {/* Focused karaoke: only the current line (+ a peek at prev/next) */}
        {lines.length > 0 &&
          (() => {
            const idx = currentLine < 0 ? 0 : currentLine;
            const prev = lines[idx - 1];
            const cur = lines[idx];
            const next = lines[idx + 1];
            return (
              <View style={styles.karaoke}>
                <Text style={styles.contextLine} numberOfLines={1}>
                  {prev ? prev.text || '♪' : ''}
                </Text>

                {/* Current line — interactive */}
                <View style={styles.currentBlock}>
                  {displayMode !== 'he' && (
                    <View style={styles.wordsArea}>
                      {canEditTranslations && editingEnTag === cur.tag ? (
                        <View style={styles.editRow}>
                          <View style={styles.editInputRow}>
                            <TextInput
                              style={styles.editInput}
                              value={editEnText}
                              onChangeText={setEditEnText}
                              multiline
                              autoFocus
                              textAlign="left"
                            />
                            <View style={styles.editBtnRow}>
                              <TouchableOpacity
                                style={styles.editBtn}
                                onPress={() => saveEnLineText(cur.tag, editEnText)}
                              >
                                <MaterialIcons name="check" size={20} color={colors.success} />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.editBtn} onPress={stopEditingEnLine}>
                                <MaterialIcons name="close" size={20} color={colors.textFaint} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          {moveStatus === 'saving' && <Text style={styles.editStatus}>שומר…</Text>}
                          {moveStatus === 'error' && (
                            <Text style={[styles.editStatus, { color: colors.danger }]}>
                              שגיאה — ה-edit server רץ?
                            </Text>
                          )}
                        </View>
                      ) : cur.text ? (
                        // A "¦" in the source (now a real newline) means the
                        // original caption showed these as separate stacked
                        // lines — keep that grouping instead of flowing all
                        // words into one paragraph, so the on-screen layout
                        // matches the source 1:1 (1 line in -> 1 line shown,
                        // 2 lines in -> 2 lines shown).
                        (() => {
                          let wi = -1;
                          return cur.text.split('\n').map((subLine, si) => (
                            <View key={si} style={styles.lineWords}>
                              {subLine.split(/\s+/).filter(Boolean).map((w) => {
                                wi++;
                                const myWi = wi;
                                const key = `${idx}-${myWi}`;
                                const isSel = selected === key;
                                const isActiveWord = karaokeOn && myWi === currentWord;
                                return (
                                  <View key={myWi} style={[styles.wordWrap, isSel && styles.wordWrapActive]}>
                                    {isSel && (
                                      <View style={styles.bubbleContainer} pointerEvents="box-none">
                                        <View style={styles.bubble}>
                                          <TouchableOpacity onPress={closeBubble} activeOpacity={0.85}>
                                            <Text style={styles.bubbleText}>{wordTranslation}</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity onPress={toggleSaveWord} hitSlop={8}>
                                            <Text style={styles.bubbleStar}>{selectedSaved ? '★' : '☆'}</Text>
                                          </TouchableOpacity>
                                        </View>
                                        <View style={styles.bubbleArrow} />
                                      </View>
                                    )}
                                    <TouchableOpacity onPress={() => onWordPress(key, w)} activeOpacity={0.7}>
                                      <Text style={[styles.currentWord, isActiveWord && styles.activeWord]}>{w}</Text>
                                    </TouchableOpacity>
                                    {canEditTranslations && (
                                      <TextInput
                                        key={`${cur.tag}-${myWi}-${wordTiming[cur.tag]?.[myWi]?.start ?? ''}`}
                                        style={styles.wordTimeInput}
                                        defaultValue={
                                          wordTiming[cur.tag]?.[myWi]
                                            ? wordTiming[cur.tag][myWi].start.toFixed(2)
                                            : ''
                                        }
                                        placeholder={(cur.time + myWi * DEFAULT_WORD_DURATION).toFixed(2)}
                                        placeholderTextColor={colors.textFaint}
                                        keyboardType="numbers-and-punctuation"
                                        onSubmitEditing={(e) =>
                                          setWordStartTime(cur.tag, cur.text, myWi, e.nativeEvent.text)
                                        }
                                        onBlur={(e: any) =>
                                          setWordStartTime(cur.tag, cur.text, myWi, e.nativeEvent.text ?? e.target?.value ?? '')
                                        }
                                      />
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          ));
                        })()
                      ) : (
                        <Text style={styles.currentWord}>♪</Text>
                      )}
                    </View>
                  )}

                  {/* Always mounted at a fixed height — even when empty — so the
                      buttons below it never jump as the translation shows,
                      hides, or changes length. */}
                  <View style={[styles.heSlot, editingTag === cur.tag && styles.heSlotEditing]}>
                    {canEditTranslations && cur.text && editingTag === cur.tag ? (
                      <View style={styles.editRow}>
                        <View style={styles.editInputRow}>
                          <TextInput
                            style={styles.editInput}
                            value={editText}
                            onChangeText={setEditText}
                            multiline
                            autoFocus
                            textAlign="right"
                          />
                          <View style={styles.editBtnRow}>
                            <TouchableOpacity
                              style={styles.editBtn}
                              onPress={async () => {
                                await saveLineTranslation(cur.tag, editText);
                                stopEditingLine();
                              }}
                            >
                              <MaterialIcons name="check" size={20} color={colors.success} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.editBtn} onPress={stopEditingLine}>
                              <MaterialIcons name="close" size={20} color={colors.textFaint} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {editStatus === 'saving' && <Text style={styles.editStatus}>שומר…</Text>}
                        {editStatus === 'error' && (
                          <Text style={[styles.editStatus, { color: colors.danger }]}>
                            שגיאה — ה-edit server רץ?
                          </Text>
                        )}
                      </View>
                    ) : cur.text && (displayMode !== 'en' || openLines[idx])
                      ? (() => {
                          // Approximate: highlight the Hebrew word at the same
                          // proportional position as the English word, since
                          // translations aren't word-aligned with the original.
                          const heText = lineHe(idx);
                          const heWords = heText.split(/\s+/).filter(Boolean);
                          const enWordCount = cur.text.split(/\s+/).filter(Boolean).length;
                          const activeHeIdx =
                            karaokeOn && currentWord >= 0 && enWordCount > 0
                              ? Math.min(heWords.length - 1, Math.floor(((currentWord + 1) / enWordCount) * heWords.length))
                              : -1;
                          // Same source-line-break preservation as the English side.
                          let heWi = -1;
                          const heSubLines = heText.split('\n').map((sub) => sub.split(/\s+/).filter(Boolean));
                          return heSubLines.map((subWords, si) => (
                            <View key={si} style={styles.lineHeRow}>
                              {subWords.map((w, wiInSub) => {
                                heWi++;
                                const myWi = heWi;
                                return (
                                  <Text
                                    key={myWi}
                                    style={[styles.lineHe, styles.lineHeWord, myWi === activeHeIdx && styles.lineHeActive]}
                                  >
                                    {w}
                                  </Text>
                                );
                              })}
                            </View>
                          ));
                        })()
                      : null}
                  </View>

                  {/* Always mounted at a fixed height, lyrics or not, so the
                      controls below never shift between sung lines and
                      instrumental (♪) gaps. */}
                  <View style={styles.lineActionsRow}>
                    {canEditTranslations && !!cur.text && editingTag !== cur.tag && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'הקדם את השורה (0.25 שניות)'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => shiftLineTime(idx, -LINE_SHIFT_STEP)}
                        activeOpacity={0.7} 
                      >
                        <MaterialIcons name="arrow-back" size={18} color={colors.primarySoft} />
                      </TouchableOpacity></View>
                    )}
                    {canEditTranslations && !!cur.text && editingTag !== cur.tag && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'דחה את השורה (0.25 שניות)'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => shiftLineTime(idx, LINE_SHIFT_STEP)}
                        activeOpacity={0.7} 
                      >
                        <MaterialIcons name="arrow-forward" size={18} color={colors.primarySoft} />
                      </TouchableOpacity></View>
                    )}
                    {canEditTranslations && !!cur.text && editingTag !== cur.tag && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'הקדם את הדגשת המילים בשורה (0.15 שניות)'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => nudgeCurrentLineTiming(idx, -1)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="fast-forward" size={18} color={colors.primarySoft} />
                      </TouchableOpacity></View>
                    )}
                    {canEditTranslations && !!cur.text && editingTag !== cur.tag && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'האט את הדגשת המילים בשורה (0.15 שניות)'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => nudgeCurrentLineTiming(idx, 1)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="fast-rewind" size={18} color={colors.primarySoft} />
                      </TouchableOpacity></View>
                    )}
                    {canEditTranslations && !!cur.text && !wordTiming[cur.tag]?.length && editingTag !== cur.tag && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'קבע תזמון מילים — לחץ ברגע שהשורה מסתיימת'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => calibrateLineSpeed(idx)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="timer" size={18} color={colors.primarySoft} />
                      </TouchableOpacity></View>
                    )}
                    {canEditTranslations && !!cur.text && editingTag !== cur.tag && editingEnTag !== cur.tag && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'ערוך את הטקסט באנגלית'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => startEditingEnLine(cur.tag, cur.text)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="text-fields" size={20} color={colors.primarySoft} />
                      </TouchableOpacity></View>
                    )}
                    {canEditTranslations && !!cur.text && editingTag !== cur.tag && editingEnTag !== cur.tag && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'ערוך את התרגום לעברית'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => startEditingLine(cur.tag, lineHe(idx))}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="edit" size={20} color={colors.warning} />
                      </TouchableOpacity></View>
                    )}
                    {canEditTranslations && !!cur.text && editingTag !== cur.tag && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'מחק את השורה הזו'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => deleteLine(cur.tag)}
                        activeOpacity={0.7} 
                      >
                        <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
                      </TouchableOpacity></View>
                    )}
                    {canEditTranslations && moveStatus === 'error' && (
                      <Text style={styles.editStatus}>שגיאה בהזזת מילה</Text>
                    )}
                    {canEditTranslations && deleteStatus === 'error' && (
                      <Text style={styles.editStatus}>שגיאה במחיקה</Text>
                    )}
                    {!!cur.text && displayMode === 'en' && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'הצג/הסתר תרגום לשורה זו'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => toggleLine(idx, cur.text)}
                        activeOpacity={0.7} 
                      >
                        <MaterialIcons
                          name="translate"
                          size={26}
                          color={openLines[idx] ? colors.primary : colors.textFaint}
                        />
                      </TouchableOpacity></View>
                    )}
                    {!!cur.text && videoId && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'שמור משפט זה לאוצר המילים'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => {
                          toggleSentence(`${videoId}:${cur.tag}`, cur.text, lineHe(idx), track || undefined);
                          setSentenceTick((t) => t + 1);
                        }}
                        activeOpacity={0.7} 
                      >
                        <Text style={styles.lineActionIcon}>
                          {isSentenceSaved(`${videoId}:${cur.tag}`) ? '★' : '☆'}
                        </Text>
                      </TouchableOpacity></View>
                    )}
                    {/* Copy the line(s) currently on screen to the clipboard —
                        an explicit button instead of relying on click-drag
                        text selection, which the per-word tap targets would
                        otherwise interfere with. */}
                    {!!cur.text && (
                      <View {...({ onMouseEnter: (e: any) => showTip(e, 'העתק את השורה ללוח'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={async () => {
                          const parts = [];
                          if (displayMode !== 'he') parts.push(cur.text);
                          if (displayMode !== 'en') parts.push(lineHe(idx));
                          await Clipboard.setStringAsync(parts.join('\n'));
                        }}
                        activeOpacity={0.7} 
                      >
                        <MaterialIcons name="content-copy" size={22} color={colors.textFaint} />
                      </TouchableOpacity></View>
                    )}
                  </View>

                  {/* Dev-only: add a sung line the captions missed entirely,
                      at whatever moment the video is paused on. */}
                  {canEditTranslations && !addingLine && (
                    <View {...({ onMouseEnter: (e: any) => showTip(e, 'הוסף שורה חדשה במיקום הנוכחי בנגן'), onMouseLeave: hideTip } as any)}><TouchableOpacity style={[styles.calBtn, styles.addLineBtn]} onPress={startAddingLine} activeOpacity={0.85} >
                      <Text style={styles.calBtnText}>+ הוסף שורה חסרה כאן</Text>
                    </TouchableOpacity></View>
                  )}
                  {canEditTranslations && addingLine && (
                    <View style={styles.addLineRow}>
                      <TextInput
                        style={styles.addLineInput}
                        value={addLineText}
                        onChangeText={setAddLineText}
                        placeholder="המשפט באנגלית..."
                        placeholderTextColor={colors.textFaint}
                        autoFocus
                      />
                      <View style={styles.editBtnRow}>
                        <View {...({ onMouseEnter: (e: any) => showTip(e, 'שמור שורה חדשה'), onMouseLeave: hideTip } as any)}><TouchableOpacity style={styles.editBtn} onPress={saveNewLine} >
                          <MaterialIcons name="check" size={20} color={colors.success} />
                        </TouchableOpacity></View>
                        <View {...({ onMouseEnter: (e: any) => showTip(e, 'בטל'), onMouseLeave: hideTip } as any)}><TouchableOpacity style={styles.editBtn} onPress={stopAddingLine} >
                          <MaterialIcons name="close" size={20} color={colors.textFaint} />
                        </TouchableOpacity></View>
                      </View>
                      {addLineStatus === 'saving' && <Text style={styles.editStatus}>שומר…</Text>}
                      {addLineStatus === 'error' && (
                        <Text style={[styles.editStatus, { color: colors.danger }]}>שגיאה — ה-edit server רץ?</Text>
                      )}
                    </View>
                  )}
                </View>

                <Text style={styles.contextLine} numberOfLines={1}>
                  {next ? next.text || '♪' : ''}
                </Text>
              </View>
            );
          })()}

        {/* Playback controls — below the lyrics */}
        {videoId && lines.length > 0 && (
          <>
            <View style={styles.controlsRow}>
              <View {...({ onMouseEnter: (e: any) => showTip(e, 'אחורה 5 שניות'), onMouseLeave: hideTip } as any)}><TouchableOpacity style={styles.ctrlBtn} onPress={() => seek(-5)} activeOpacity={0.8} >
                <Text style={styles.ctrlText}>⏪ 5</Text>
              </TouchableOpacity></View>
              <View {...({ onMouseEnter: (e: any) => showTip(e, isPlaying ? 'עצור' : 'נגן'), onMouseLeave: hideTip } as any)}>
                <TouchableOpacity style={[styles.ctrlBtn, styles.playBtn]} onPress={togglePlay} activeOpacity={0.8}>
                  <Text style={styles.ctrlText}>{isPlaying ? '⏸  עצור' : '▶  נגן'}</Text>
                </TouchableOpacity>
              </View>
              <View {...({ onMouseEnter: (e: any) => showTip(e, 'קדימה 5 שניות'), onMouseLeave: hideTip } as any)}><TouchableOpacity style={styles.ctrlBtn} onPress={() => seek(5)} activeOpacity={0.8} >
                <Text style={styles.ctrlText}>5 ⏩</Text>
              </TouchableOpacity></View>
            </View>

            {/* Calibration tools — shown ONLY in development (npm start), so
                you can find the right offset and bake it into defaultOffsets.
                Hidden for users in the published app. */}
            {__DEV__ && (
              <>
                <Text style={styles.syncHint}>
                  [DEV] סנכרון: לחץ "כייל" כשהמילה הראשונה נשמעת — ערך: {syncOffset.toFixed(1)}s
                </Text>
                <View style={styles.offsetRow}>
                  <View {...({ onMouseEnter: (e: any) => showTip(e, 'כייל סנכרון אוטומטית למילה הראשונה הנשמעת עכשיו'), onMouseLeave: hideTip } as any)}><TouchableOpacity style={styles.calBtn} onPress={calibrate} activeOpacity={0.85} >
                    <Text style={styles.calBtnText}>🎯 כייל</Text>
                  </TouchableOpacity></View>
                  <View {...({ onMouseEnter: (e: any) => showTip(e, 'הקטן את ערך הסנכרון ב-0.5 שניות'), onMouseLeave: hideTip } as any)}><TouchableOpacity style={styles.offsetBtn} onPress={() => adjustOffset(-0.5)} hitSlop={6} >
                    <Text style={styles.offsetBtnText}>−</Text>
                  </TouchableOpacity></View>
                  <TextInput
                    style={styles.offsetInput}
                    value={offsetText}
                    onChangeText={setOffsetText}
                    onBlur={() => applyOffsetText(offsetText)}
                    onSubmitEditing={() => applyOffsetText(offsetText)}
                    keyboardType="numbers-and-punctuation"
                    inputMode="decimal"
                    textAlign="center" {...({ onMouseEnter: (e: any) => showTip(e, 'ערך הסנכרון הנוכחי — אפשר להקליד ידנית'), onMouseLeave: hideTip } as any)}
                  />
                  <Text style={styles.offsetLabel}>s</Text>
                  <View {...({ onMouseEnter: (e: any) => showTip(e, 'הגדל את ערך הסנכרון ב-0.5 שניות'), onMouseLeave: hideTip } as any)}><TouchableOpacity style={styles.offsetBtn} onPress={() => adjustOffset(0.5)} hitSlop={6} >
                    <Text style={styles.offsetBtnText}>+</Text>
                  </TouchableOpacity></View>
                </View>
                {canEditTranslations && (
                  <View style={styles.editServerStatusRow}>
                    <View
                      style={[
                        styles.editServerDot,
                        { backgroundColor: editServerUp ? colors.success : colors.danger },
                      ]}
                    />
                    <Text style={styles.syncHint}>
                      {editServerUp ? 'edit server מחובר' : 'edit server לא רץ — npm run edit-server'}
                    </Text>
                  </View>
                )}
                {canEditTranslations && (
                  <View style={styles.offsetRow}>
                    <View {...({ onMouseEnter: (e: any) => showTip(e, 'דחוף את כל השינויים שנשמרו מקומית ל-GitHub'), onMouseLeave: hideTip } as any)}><TouchableOpacity style={styles.calBtn} onPress={pushAllChanges} activeOpacity={0.85} >
                      <Text style={styles.calBtnText}>⬆ Push לגיט</Text>
                    </TouchableOpacity></View>
                    {pushStatus === 'pushing' && <Text style={styles.syncHint}>דוחף…</Text>}
                    {pushStatus === 'pushed' && (
                      <Text style={[styles.syncHint, { color: colors.success }]}>נדחף בהצלחה</Text>
                    )}
                    {pushStatus === 'error' && (
                      <Text style={[styles.syncHint, { color: colors.danger }]}>שגיאה בדחיפה</Text>
                    )}
                  </View>
                )}
                {canEditTranslations && (
                  <View style={styles.offsetRow}>
                    <View {...({ onMouseEnter: (e: any) => showTip(e, 'מחק את כל המשפטים, התרגומים והתזמון של השיר הזה'), onMouseLeave: hideTip } as any)}><TouchableOpacity
                      style={[styles.calBtn, { backgroundColor: colors.danger }]}
                      onPress={clearAllLines}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.calBtnText}>🗑 מחק את כל המשפטים</Text>
                    </TouchableOpacity></View>
                    {clearStatus === 'saving' && <Text style={styles.syncHint}>מוחק…</Text>}
                    {clearStatus === 'error' && (
                      <Text style={[styles.syncHint, { color: colors.danger }]}>שגיאה במחיקה</Text>
                    )}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      {tooltip && Platform.OS === 'web' && typeof document !== 'undefined'
        ? require('react-dom').createPortal(
            <View
              style={[styles.hoverTooltip, { left: tooltip.left, top: tooltip.top, position: 'fixed' } as any]}
              pointerEvents="none"
            >
              <Text style={styles.hoverTooltipText}>{tooltip.label}</Text>
            </View>,
            document.body
          )
        : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, position: 'relative' },
  hoverTooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 240,
    zIndex: 999,
  },
  hoverTooltipText: { color: '#fff', fontSize: 12, textAlign: 'right' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  back: { color: colors.primarySoft, fontSize: 20, fontFamily: fonts.bold },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', paddingHorizontal: spacing.lg, marginBottom: spacing.md },

  inputRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  smallBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: colors.danger, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  playerWrap: { padding: spacing.sm, paddingBottom: spacing.xs },
  nowPlaying: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: spacing.md },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.xs, paddingHorizontal: spacing.lg },
  ctrlBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  ctrlText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  playBtn: { backgroundColor: colors.primary, borderColor: colors.primary, minWidth: 110, alignItems: 'center' },

  section: { paddingHorizontal: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  metaInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  bigBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center' },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  offsetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  syncHint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.md },
  editServerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  editServerDot: { width: 8, height: 8, borderRadius: 4 },
  calBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  calBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  offsetLabel: { color: colors.textMuted, fontSize: 14 },
  offsetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offsetBtnText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  offsetValue: { color: colors.text, fontSize: 15, fontWeight: '700', minWidth: 48, textAlign: 'center' },
  offsetInput: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLight,
  },

  langModeRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  langModeBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  langModeBtnActive: { backgroundColor: colors.primary },
  langModeText: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bold },
  langModeTextActive: { color: '#fff' },

  karaokeToggle: {
    alignSelf: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  karaokeToggleActive: { borderColor: colors.primary, backgroundColor: colors.surfaceLight },
  karaokeToggleText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  karaokeToggleTextActive: { color: colors.primarySoft },

  // Focused karaoke view
  karaoke: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, alignItems: 'center' },
  // Fixed height (an empty peek line — at the very start/end of a song —
  // would otherwise collapse to ~0 height and shift everything below it).
  // Also gives the tap-a-word bubble (which pops up above the word) room
  // to clear the language selector above it instead of overlapping it.
  contextLine: {
    height: 28,
    color: colors.textFaint,
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 2,
    opacity: 0.6,
    maxWidth: '90%',
  },
  // width: '100%' keeps this a fixed-width box regardless of how long the
  // line/translation is, so the action icons (positioned absolute relative
  // to it) stay put instead of drifting right with longer sentences.
  currentBlock: { width: '100%', paddingHorizontal: 30, marginVertical: 2, alignItems: 'center' },
  // Fixed-height area so single- vs double-row lines don't shift the layout.
  // No overflow:hidden here — the tap-a-word translation bubble is
  // absolutely positioned above the word (bottom: '100%') and needs to
  // escape this box upward, or it gets clipped off.
  // Tall enough for a 3-line wrapped sentence (3 * 32 lineHeight) — a
  // shorter fixed height let long lines spill into (overlap) the
  // translation slot below them.
  wordsArea: { height: 104, justifyContent: 'center' },
  lineWords: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', position: 'relative' },
  currentWord: { color: colors.primarySoft, fontSize: 22, lineHeight: 32, fontWeight: '700' },
  // Color only — no size change, so highlighting a word never reflows the
  // line (which could push a sentence from one line to two and shift
  // everything below it).
  activeWord: { color: '#ffffff' },
  lineActive: { color: colors.primarySoft },
  // Fixed-height slot so showing/changing the translation doesn't move things.
  // Fixed height (not minHeight) so a 1-line vs 2-line translation never
  // changes the box size — keeps the buttons below it from jumping.
  heSlot: { height: 54, justifyContent: 'center', marginTop: 2, overflow: 'hidden' },
  heSlotEditing: { height: 'auto', minHeight: 54, overflow: 'visible' },
  lineHeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  // Every word shares the exact same font size/weight — only the text color
  // changes — so highlighting the active word never resizes or reflows
  // the sentence.
  lineHe: { color: colors.primarySoft, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  // A real layout gap instead of a trailing space character — a plain space
  // between two Text spans can visually collapse when an embedded
  // left-to-right run (e.g. a product name) sits next to Hebrew text, since
  // the browser's bidi reordering doesn't always preserve it.
  lineHeWord: { marginStart: 5 },
  lineHeActive: { color: '#ffffff' },

  // Dev-only (desktop web) inline editor for fixing a mistranslated line.
  editRow: { width: '100%' },
  editInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  editBtnRow: { flexDirection: 'row', gap: 4 },
  editBtn: { padding: 4 },
  editStatus: { color: colors.textFaint, fontSize: 11, width: '100%', textAlign: 'right' },

  // Dev-only: insert a sung line the captions missed entirely.
  addLineBtn: { marginTop: spacing.md, alignSelf: 'center' },
  addLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: 'center',
  },
  addLineInput: {
    width: 180,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    textAlign: 'left',
  },

  wordWrap: { position: 'relative', alignItems: 'center', marginHorizontal: 4 },
  wordWrapActive: { zIndex: 20 },

  // Normal-flow row (not absolutely positioned), so it always sits in the
  // same place under the line regardless of how long the text is.
  // Fixed height and always mounted (even with no line/icons to show) so
  // nothing below it ever shifts up or down.
  lineActionsRow: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginTop: 2 },
  lineActionBtn: { padding: 4 },
  lineActionIcon: { fontSize: 26, color: colors.textFaint },
  lineActionIconActive: { color: colors.primarySoft },
  wordTimeInput: {
    width: 44,
    fontSize: 10,
    color: colors.textFaint,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    textAlign: 'center',
    marginTop: 2,
    paddingVertical: 1,
  },

  // Translation bubble above a tapped word.
  bubbleContainer: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 6,
    left: -1000,
    right: -1000,
    alignItems: 'center',
    zIndex: 30,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.md,
    marginBottom: 2,
  },
  bubbleText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bubbleStar: { fontSize: 19, color: '#ffe066' },
  bubbleSpeak: { fontSize: 16 },
  bubbleArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
  },
});
