import { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
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
// Extra lead time for per-word highlight — so the word lights up just before it's sung.
const WORD_LOOKAHEAD = 0.6; // seconds

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
    const text = raw.replace(/\[.*?\]/g, '').trim();
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
  const [loading, setLoading] = useState(false);
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
  // High-quality curated translations bundled with the app (time -> Hebrew).
  const [bundledTr, setBundledTr] = useState<Record<string, string>>({});
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
    return (key && bundledTr[key]) || lineTranslations[i] || '...';
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
  async function toggleLine(i: number, text: string) {
    setOpenLines((prev) => ({ ...prev, [i]: !prev[i] }));
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

  // When the player is ready, read the video title, fill artist/track,
  // and automatically search for the synced lyrics.
  function onPlayerReady(player: any) {
    playerRef.current = player;
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
        const weights = words.map((w) => 140 + w.replace(/[^a-zA-Z']/g, '').length * 60);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let acc = 0;
        const boundaries = weights.map((w) => (acc += w, (acc / totalWeight) * duration));

        // On fast songs each word only gets a tiny slice of time, so cap the
        // lookahead to a fraction of a single word's duration — otherwise it
        // overshoots and the highlight races ahead of the singing.
        const avgWordDuration = duration / words.length;
        const lookahead = Math.min(WORD_LOOKAHEAD, avgWordDuration * 0.8);
        const elapsed = (t + lookahead) - lineStart;
        let wi = boundaries.findIndex((b) => elapsed < b);
        if (wi === -1) wi = words.length - 1;
        setCurrentWord(wi);
      } else {
        setCurrentWord(-1);
      }
    }, 120);
    return () => clearInterval(id);
  }, [lines, syncOffset]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
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
            <TouchableOpacity style={styles.smallBtn} onPress={loadVideo} activeOpacity={0.85}>
              <Text style={styles.smallBtnText}>טען</Text>
            </TouchableOpacity>
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Player */}
        {videoId && (
          <View style={styles.playerWrap}>
            <YouTubePlayer videoId={videoId} onReady={onPlayerReady} />
          </View>
        )}

        {/* Find synced lyrics (setup only) */}
        {videoId && lines.length === 0 && (
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
                      <View style={styles.lineWords}>
                        {cur.text ? (
                          cur.text.split(/\s+/).map((w, wi) => {
                            const key = `${idx}-${wi}`;
                            const isSel = selected === key;
                            const isActiveWord = wi === currentWord;
                            return (
                              <View key={wi} style={[styles.wordWrap, isSel && styles.wordWrapActive]}>
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
                              </View>
                            );
                          })
                        ) : (
                          <Text style={styles.currentWord}>♪</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Always mounted at a fixed height — even when empty — so the
                      buttons below it never jump as the translation shows,
                      hides, or changes length. */}
                  <View style={styles.heSlot}>
                    {cur.text && (displayMode !== 'en' || openLines[idx])
                      ? (() => {
                          // Approximate: highlight the Hebrew word at the same
                          // proportional position as the English word, since
                          // translations aren't word-aligned with the original.
                          const heWords = lineHe(idx).split(/\s+/);
                          const enWordCount = cur.text.split(/\s+/).length;
                          const activeHeIdx =
                            currentWord >= 0 && enWordCount > 0
                              ? Math.min(heWords.length - 1, Math.floor(((currentWord + 1) / enWordCount) * heWords.length))
                              : -1;
                          return (
                            <View style={styles.lineHeRow}>
                              {heWords.map((w, wi) => (
                                <Text key={wi} style={[styles.lineHe, wi === activeHeIdx && styles.lineHeActive]}>
                                  {w}
                                  {wi < heWords.length - 1 ? ' ' : ''}
                                </Text>
                              ))}
                            </View>
                          );
                        })()
                      : null}
                  </View>

                  {/* Always mounted at a fixed height, lyrics or not, so the
                      controls below never shift between sung lines and
                      instrumental (♪) gaps. */}
                  <View style={styles.lineActionsRow}>
                    {cur.text && displayMode === 'en' && (
                      <TouchableOpacity
                        style={styles.lineActionBtn}
                        onPress={() => toggleLine(idx, cur.text)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name="translate"
                          size={19}
                          color={openLines[idx] ? colors.primary : colors.textFaint}
                        />
                      </TouchableOpacity>
                    )}
                    {cur.text && videoId && (
                      <TouchableOpacity
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
                      </TouchableOpacity>
                    )}
                  </View>
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
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => seek(-10)} activeOpacity={0.8}>
                <Text style={styles.ctrlText}>⏪ 10</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtn, styles.playBtn]} onPress={togglePlay} activeOpacity={0.8}>
                <Text style={styles.ctrlText}>{isPlaying ? '⏸  עצור' : '▶  נגן'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => seek(10)} activeOpacity={0.8}>
                <Text style={styles.ctrlText}>10 ⏩</Text>
              </TouchableOpacity>
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
                  <TouchableOpacity style={styles.calBtn} onPress={calibrate} activeOpacity={0.85}>
                    <Text style={styles.calBtnText}>🎯 כייל</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.offsetBtn} onPress={() => adjustOffset(-0.5)} hitSlop={6}>
                    <Text style={styles.offsetBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.offsetValue}>{syncOffset > 0 ? '+' : ''}{syncOffset.toFixed(1)}s</Text>
                  <TouchableOpacity style={styles.offsetBtn} onPress={() => adjustOffset(0.5)} hitSlop={6}>
                    <Text style={styles.offsetBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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

  // Focused karaoke view
  karaoke: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, alignItems: 'center' },
  contextLine: {
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
  wordsArea: { height: 76, justifyContent: 'center' },
  lineWords: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', position: 'relative' },
  currentWord: { color: colors.primarySoft, fontSize: 22, lineHeight: 32, fontWeight: '700' },
  activeWord: { color: '#ffffff', fontSize: 24 },
  lineActive: { color: colors.primarySoft },
  // Fixed-height slot so showing/changing the translation doesn't move things.
  // Fixed height (not minHeight) so a 1-line vs 2-line translation never
  // changes the box size — keeps the buttons below it from jumping.
  heSlot: { height: 54, justifyContent: 'center', marginTop: 2, overflow: 'hidden' },
  lineHeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  // Every word shares the exact same font size/weight — only the text color
  // changes — so highlighting the active word never resizes or reflows
  // the sentence.
  lineHe: { color: colors.primarySoft, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  lineHeActive: { color: '#ffffff' },

  wordWrap: { position: 'relative', alignItems: 'center', marginHorizontal: 4 },
  wordWrapActive: { zIndex: 20 },

  // Normal-flow row (not absolutely positioned), so it always sits in the
  // same place under the line regardless of how long the text is.
  // Fixed height and always mounted (even with no line/icons to show) so
  // nothing below it ever shifts up or down.
  lineActionsRow: { height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginTop: 2 },
  lineActionBtn: { padding: 4 },
  lineActionIcon: { fontSize: 19, color: colors.textFaint },
  lineActionIconActive: { color: colors.primarySoft },

  // Translation bubble above a tapped word.
  bubbleContainer: {
    position: 'absolute',
    bottom: '100%',
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
