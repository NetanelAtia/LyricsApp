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
import { colors, radius, spacing } from '../theme';

const cleanWord = (w: string) => w.replace(/[^a-zA-Z']/g, '').toLowerCase();

// Show each line/translation slightly BEFORE it's sung, so it's easy to read ahead.
const LOOKAHEAD = 0.4; // seconds

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

type LrcLine = { time: number; text: string };

// Turn an LRC string ("[00:12.50] words") into timed lines.
function parseLrc(lrc: string): LrcLine[] {
  const out: LrcLine[] = [];
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
    if (!m) continue;
    const time = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    const text = raw.replace(/\[.*?\]/g, '').trim();
    out.push({ time, text });
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

export default function YouTubeScreen({ navigation }: any) {
  const [link, setLink] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [artist, setArtist] = useState('');
  const [track, setTrack] = useState('');
  const [lines, setLines] = useState<LrcLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [lrcError, setLrcError] = useState('');
  const [offset, setOffset] = useState(0); // seconds, to nudge sync vs the video
  const [currentLine, setCurrentLine] = useState(-1);

  // Tapped word -> translation bubble.
  const [selected, setSelected] = useState<string | null>(null); // "line-word" key
  const [wordTranslation, setWordTranslation] = useState('');
  // Per-line "translate whole line" toggle + cached results.
  const [openLines, setOpenLines] = useState<Record<number, boolean>>({});
  const [lineTranslations, setLineTranslations] = useState<Record<number, string>>({});
  // "Always show translation" mode — keeps Hebrew under every line.
  const [alwaysTranslate, setAlwaysTranslate] = useState(false);

  const playerRef = useRef<any>(null);

  const getTime = () => playerRef.current?.getCurrentTime?.() ?? 0;

  // Jump backward/forward by `delta` seconds.
  function seek(delta: number) {
    const t = getTime();
    playerRef.current?.seekTo?.(Math.max(0, t + delta), true);
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
    setSelected(key);
    playerRef.current?.pauseVideo?.();
    const w = cleanWord(word);
    // Show instantly if we already have it cached (offline); otherwise fetch.
    const cached = cachedTranslation(w);
    setWordTranslation(cached ?? '...');
    if (!cached) {
      const tr = await translateToHebrew(w);
      setWordTranslation(tr);
    }
  }

  // Toggle the full-line translation. Opening pauses the song; closing resumes.
  async function toggleLine(i: number, text: string) {
    const willOpen = !openLines[i];
    setOpenLines((prev) => ({ ...prev, [i]: willOpen }));
    if (willOpen) {
      playerRef.current?.pauseVideo?.();
      if (!lineTranslations[i]) {
        const tr = await translateToHebrew(text);
        setLineTranslations((prev) => ({ ...prev, [i]: tr }));
      }
    } else {
      playerRef.current?.playVideo?.();
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
    setOpenLines({});
    setSelected(null);
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
        setLrcError('לא נמצאו מילים מסונכרנות לשיר הזה. נסה לתקן את שם השיר/האמן.');
      } else {
        const parsed = parseLrc(hit.syncedLyrics);
        setLines(parsed);
        if (videoId) saveLrcCache(videoId, parsed);
        playerRef.current?.playVideo?.();
        preTranslateLines(parsed); // translate all lines ahead of time
      }
    } catch {
      setLrcError('שגיאה בחיבור למאגר המילים.');
    }
    setLoading(false);
  }

  // In "always translate" mode, fetch the current line's translation
  // automatically as the song moves from line to line.
  useEffect(() => {
    if (!alwaysTranslate) return;
    const idx = currentLine < 0 ? 0 : currentLine;
    const cur = lines[idx];
    if (cur && cur.text && !lineTranslations[idx]) {
      translateToHebrew(cur.text).then((tr) =>
        setLineTranslations((prev) => ({ ...prev, [idx]: tr }))
      );
    }
  }, [alwaysTranslate, currentLine, lines]);

  // Follow the video time and highlight the matching line.
  useEffect(() => {
    if (lines.length === 0) return;
    const id = setInterval(() => {
      const t = getTime() - offset + LOOKAHEAD;
      let idx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= t) idx = i;
      }
      setCurrentLine(idx);
    }, 120);
    return () => clearInterval(id);
  }, [lines, offset]);

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

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {lines.length === 0 && <Text style={styles.title}>🎬 YouTube Karaoke</Text>}

        {/* Link input (setup only) */}
        {lines.length === 0 && (
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

        {/* Seek controls (10s back / forward) — works on mobile too */}
        {videoId && (
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => seek(-10)} activeOpacity={0.8}>
              <Text style={styles.ctrlText}>⏪ 10</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => seek(10)} activeOpacity={0.8}>
              <Text style={styles.ctrlText}>10 ⏩</Text>
            </TouchableOpacity>
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

        {/* Offset adjuster */}
        {lines.length > 0 && (
          <View style={styles.offsetRow}>
            <Text style={styles.offsetLabel}>כיוונון סנכרון:</Text>
            <TouchableOpacity style={styles.offsetBtn} onPress={() => setOffset((o) => +(o - 0.3).toFixed(1))}>
              <Text style={styles.offsetBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.offsetValue}>{offset > 0 ? '+' : ''}{offset.toFixed(1)}s</Text>
            <TouchableOpacity style={styles.offsetBtn} onPress={() => setOffset((o) => +(o + 0.3).toFixed(1))}>
              <Text style={styles.offsetBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Always-on translation toggle */}
        {lines.length > 0 && (
          <TouchableOpacity
            style={[styles.translateToggle, alwaysTranslate && styles.translateToggleActive]}
            onPress={() => setAlwaysTranslate((v) => !v)}
            activeOpacity={0.85}
          >
            <Text style={[styles.translateToggleText, alwaysTranslate && styles.translateToggleTextActive]}>
              {alwaysTranslate ? '✓ מציג תרגום' : 'הצג תרגום'}
            </Text>
          </TouchableOpacity>
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
                  <View style={styles.lineWords}>
                    {cur.text ? (
                      cur.text.split(/\s+/).map((w, wi) => {
                        const key = `${idx}-${wi}`;
                        const isSel = selected === key;
                        return (
                          <View key={wi} style={[styles.wordWrap, isSel && styles.wordWrapActive]}>
                            {isSel && (
                              <View style={styles.bubbleContainer} pointerEvents="box-none">
                                <TouchableOpacity style={styles.bubble} onPress={closeBubble} activeOpacity={0.85}>
                                  <Text style={styles.bubbleText}>{wordTranslation}</Text>
                                </TouchableOpacity>
                                <View style={styles.bubbleArrow} />
                              </View>
                            )}
                            <TouchableOpacity onPress={() => onWordPress(key, w)} activeOpacity={0.7}>
                              <Text style={styles.currentWord}>{w}</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.currentWord}>♪</Text>
                    )}

                    {cur.text ? (
                      <TouchableOpacity
                        style={styles.lineTranslateBtn}
                        onPress={() => toggleLine(idx, cur.text)}
                        hitSlop={8}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name="translate"
                          size={18}
                          color={openLines[idx] ? colors.primarySoft : colors.textFaint}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {(openLines[idx] || alwaysTranslate) && cur.text ? (
                    <Text style={styles.lineHe}>{lineTranslations[idx] || '...'}</Text>
                  ) : null}
                </View>

                <Text style={styles.contextLine} numberOfLines={1}>
                  {next ? next.text || '♪' : ''}
                </Text>
              </View>
            );
          })()}
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
    paddingVertical: spacing.sm,
  },
  back: { color: colors.primarySoft, fontSize: 17, fontWeight: '600' },
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
  playerWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  ctrlBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  ctrlText: { color: colors.text, fontWeight: '700', fontSize: 16 },

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

  translateToggle: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  translateToggleActive: { backgroundColor: colors.surfaceLight, borderColor: colors.primary },
  translateToggleText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  translateToggleTextActive: { color: colors.text },

  // Focused karaoke view
  karaoke: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, alignItems: 'center' },
  contextLine: {
    color: colors.textFaint,
    fontSize: 15,
    textAlign: 'center',
    marginVertical: spacing.md,
    opacity: 0.6,
    maxWidth: '90%',
  },
  currentBlock: { paddingHorizontal: 30, marginVertical: spacing.sm },
  lineWords: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', position: 'relative' },
  currentWord: { color: colors.primarySoft, fontSize: 25, lineHeight: 40, fontWeight: '700' },
  lineActive: { color: colors.primarySoft },
  lineHe: { color: colors.text, fontSize: 21, fontWeight: '700', textAlign: 'center', marginTop: spacing.md },

  wordWrap: { position: 'relative', alignItems: 'center', marginHorizontal: 4 },
  wordWrapActive: { zIndex: 20 },

  lineTranslateBtn: {
    position: 'absolute',
    right: -28,
    top: 0,
    bottom: 0,
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
