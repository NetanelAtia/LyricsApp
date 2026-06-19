import { useState, useEffect, useMemo, useRef } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getVocab, removeWord, VocabWord } from '../vocab';
import { award, getProgress, getLevel, xpIntoLevel, XP_PER_LEVEL, onXpGain } from '../progress';
import { speakWord } from '../speech';
import { colors, radius, spacing } from '../theme';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Mode = 'list' | 'memory' | 'spell';

export default function VocabScreen({ navigation }: any) {
  const [words, setWords] = useState<VocabWord[]>(getVocab());
  const [mode, setMode] = useState<Mode>('list');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (mode === 'list' ? navigation.goBack() : setMode('list'))} hitSlop={12}>
          <Text style={styles.back}>‹ {mode === 'list' ? 'Back' : 'אוצר המילים'}</Text>
        </TouchableOpacity>
      </View>

      {mode === 'list' && (
        <ListView
          words={words}
          onRemove={(w) => { removeWord(w); setWords(getVocab()); }}
          onMemory={() => setMode('memory')}
          onSpell={() => setMode('spell')}
        />
      )}
      {mode === 'memory' && <Memory words={words} onExit={() => setMode('list')} />}
      {mode === 'spell' && <Spell words={words} onExit={() => setMode('list')} />}
    </SafeAreaView>
  );
}

function ListView({
  words,
  onRemove,
  onMemory,
  onSpell,
}: {
  words: VocabWord[];
  onRemove: (w: string) => void;
  onMemory: () => void;
  onSpell: () => void;
}) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>📚 אוצר המילים שלי</Text>
        <Text style={styles.subtitle}>{words.length} מילים שמורות</Text>
      </View>

      {words.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>עוד לא שמרת מילים.</Text>
          <Text style={styles.emptyHint}>בתוך שיר, לחץ על מילה ואז על הכוכב ★ כדי לשמור אותה כאן.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={words}
          keyExtractor={(w) => w.word}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity onPress={() => onRemove(item.word)} hitSlop={10}>
                <Text style={styles.remove}>✕</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowWord}>{item.word}</Text>
                <Text style={styles.rowTr}>{item.translation}</Text>
                {item.song ? <Text style={styles.rowSong}>🎵 {item.song}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => speakWord(item.word)} hitSlop={10}>
                <Text style={styles.speak}>🔊</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {words.length > 0 && (
        <View style={styles.practiceBar}>
          <Text style={styles.practiceTitle}>תרגול</Text>
          <View style={styles.practiceRow}>
            <TouchableOpacity
              style={[styles.gameBtn, words.length < 3 && styles.btnDisabled]}
              onPress={words.length < 3 ? undefined : onMemory}
              activeOpacity={0.85}
            >
              <Text style={styles.gameBtnText}>🧠  משחק הזכרון</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gameBtn} onPress={onSpell} activeOpacity={0.85}>
              <Text style={styles.gameBtnText}>✏️  השלמת מילה</Text>
            </TouchableOpacity>
          </View>
          {words.length < 3 && <Text style={styles.hintSmall}>למשחק הזכרון צריך לפחות 3 מילים</Text>}
        </View>
      )}
    </>
  );
}

// Small live XP bar shown above games, so progress fills visibly as you play.
function LiveXpBar() {
  const [p, setP] = useState(getProgress());
  useEffect(() => onXpGain(() => setP(getProgress())), []);
  const level = getLevel(p.xp);
  const inLevel = xpIntoLevel(p.xp);
  return (
    <View style={styles.xpBarWrap}>
      <View style={styles.xpBarRow}>
        <Text style={styles.xpBarLevel}>רמה {level}</Text>
        <Text style={styles.xpBarXp}>{inLevel} / {XP_PER_LEVEL} XP</Text>
      </View>
      <View style={styles.xpBarTrack}>
        <View style={[styles.xpBarFill, { width: `${(inLevel / XP_PER_LEVEL) * 100}%` }]} />
      </View>
    </View>
  );
}

// Memory game: tap a word on one side, then its match on the other — either side first.
function Memory({ words, onExit }: { words: VocabWord[]; onExit: () => void }) {
  const BATCH = 6;
  const [round, setRound] = useState(0);
  const roundWords = useMemo(
    () => shuffle(words).slice(0, Math.min(BATCH, words.length)),
    [round, words]
  );

  const [left, setLeft] = useState<VocabWord[]>([]);
  const [right, setRight] = useState<VocabWord[]>([]);
  const [sel, setSel] = useState<{ side: 'l' | 'r'; word: string } | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [justMatched, setJustMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);

  useEffect(() => {
    setLeft(shuffle(roundWords));
    setRight(shuffle(roundWords));
    setSel(null);
    setMatched([]);
    setJustMatched([]);
    setWrong(null);
  }, [roundWords]);

  const allMatched = roundWords.length > 0 && matched.length === roundWords.length;

  function tap(side: 'l' | 'r', word: string) {
    if (matched.includes(word) || justMatched.includes(word)) return;
    setWrong(null);
    if (!sel) { setSel({ side, word }); return; }
    if (sel.side === side) { setSel({ side, word }); return; } // reselect on same side
    if (sel.word === word) {
      setJustMatched((j) => [...j, word]);
      setSel(null);
      award(true, 10, word);
      setTimeout(() => {
        setJustMatched((j) => j.filter((w) => w !== word));
        setMatched((m) => [...m, word]);
      }, 500);
    } else {
      setWrong(word);
      setSel(null);
      award(false, 0);
      setTimeout(() => setWrong(null), 600);
    }
  }

  if (allMatched) {
    return (
      <Done text="התאמת את כל המילים בסבב." onAgain={() => setRound((r) => r + 1)} onExit={onExit} againLabel="🔁  סבב נוסף" />
    );
  }

  return (
    <View style={styles.matchWrap}>
      <LiveXpBar />
      <Text style={styles.matchHint}>התאם כל מילה לתרגום שלה (אפשר להתחיל מכל צד)</Text>
      <View style={styles.matchCols}>
        <View style={styles.matchCol}>
          {left.map((w) => {
            const m = matched.includes(w.word);
            const jm = justMatched.includes(w.word);
            const s = sel?.side === 'l' && sel.word === w.word;
            return (
              <TouchableOpacity key={w.word} style={[styles.tile, s && styles.tileSel, jm && styles.tileCorrect, m && styles.tileGone]} onPress={() => tap('l', w.word)} disabled={m || jm} activeOpacity={0.8}>
                <Text style={[styles.tileText, m && styles.tileTextDim]}>{w.word}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.matchCol}>
          {right.map((w) => {
            const m = matched.includes(w.word);
            const jm = justMatched.includes(w.word);
            const s = sel?.side === 'r' && sel.word === w.word;
            const bad = wrong === w.word;
            return (
              <TouchableOpacity key={w.word} style={[styles.tile, s && styles.tileSel, bad && styles.tileWrong, jm && styles.tileCorrect, m && styles.tileGone]} onPress={() => tap('r', w.word)} disabled={m || jm} activeOpacity={0.8}>
                <Text style={[styles.tileText, m && styles.tileTextDim]}>{w.translation}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <TouchableOpacity style={styles.exitBtn} onPress={onExit} hitSlop={10}>
        <Text style={styles.exitText}>סיום</Text>
      </TouchableOpacity>
    </View>
  );
}

// Spell game: the Hebrew is the clue; the English word shows with some letters
// missing as empty boxes, and you type the missing letters to complete it.
function Spell({ words, onExit }: { words: VocabWord[]; onExit: () => void }) {
  const queue = useMemo(() => shuffle(words), [words]);
  const [pos, setPos] = useState(0);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<'typing' | 'right' | 'wrong'>('typing');
  const inputRef = useRef<TextInput>(null);

  const card = queue[pos];

  // Decide which letter positions are blank for this word.
  const blanks = useMemo(() => {
    if (!card) return [] as number[];
    const len = card.word.length;
    const count = Math.max(1, Math.round(len * 0.4));
    return shuffle([...Array(len).keys()]).slice(0, count).sort((a, b) => a - b);
  }, [card]);

  // A row of tappable letters to fill the blanks: the right letters mixed
  // with a few wrong decoys, so you can complete the word by tapping too.
  const pool = useMemo(() => {
    if (!card) return [] as { id: number; ch: string }[];
    const correct = blanks.map((bi) => card.word[bi].toLowerCase());
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const decoyCount = Math.max(3, blanks.length);
    const decoys: string[] = [];
    while (decoys.length < decoyCount) {
      decoys.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
    return shuffle([...correct, ...decoys].map((ch, id) => ({ id, ch })));
  }, [card]);
  const [usedIds, setUsedIds] = useState<number[]>([]);

  useEffect(() => {
    setTyped('');
    setStatus('typing');
    setUsedIds([]);
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [pos]);

  if (!card || pos >= queue.length) {
    return <Done text="סיימת את כל המילים!" onAgain={() => setPos(0)} onExit={onExit} againLabel="🔁  עוד פעם" />;
  }

  function onType(text: string) {
    const clean = text.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, blanks.length);
    setTyped(clean);
    if (clean.length === blanks.length) {
      const ok = blanks.every((bi, k) => clean[k] === card.word[bi].toLowerCase());
      if (ok) {
        setStatus('right');
        award(true, 15, card.word);
        setTimeout(() => setPos((p) => p + 1), 700);
      } else {
        setStatus('wrong');
        award(false, 0);
        setTimeout(() => { setTyped(''); setStatus('typing'); setUsedIds([]); inputRef.current?.focus(); }, 700);
      }
    }
  }

  function tapLetter(id: number, ch: string) {
    if (status !== 'typing' || usedIds.includes(id)) return;
    setUsedIds((u) => [...u, id]);
    onType(typed + ch);
  }

  return (
    <View style={{ flex: 1 }}>
      <LiveXpBar />
      <View style={styles.center}>
      <Text style={styles.progress}>{pos + 1} / {queue.length}</Text>
      <Text style={styles.spellClue}>{card.translation}</Text>

      <View style={styles.boxesWrap}>
        <View style={styles.boxes}>
          {card.word.split('').map((ch, i) => {
            const blankIndex = blanks.indexOf(i);
            const isBlank = blankIndex !== -1;
            const typedChar = isBlank ? typed[blankIndex] : '';
            const isNext = isBlank && blankIndex === typed.length && status === 'typing';
            const show = isBlank ? (typedChar || '') : ch;
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  isBlank && styles.boxBlank,
                  isNext && styles.boxNext,
                  status === 'right' && styles.boxRight,
                  status === 'wrong' && isBlank && styles.boxWrong,
                ]}
              >
                <Text style={styles.boxText}>{show.toUpperCase()}</Text>
              </View>
            );
          })}
        </View>
        {/* Invisible input over the boxes — captures typing straight into them */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={typed}
          onChangeText={onType}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      </View>
      <Text style={styles.spellHint}>הקלד או לחץ על האותיות החסרות ⌨️</Text>

      <View style={styles.letterPool}>
        {pool.map(({ id, ch }) => {
          const used = usedIds.includes(id);
          return (
            <TouchableOpacity
              key={id}
              disabled={used || status !== 'typing'}
              onPress={() => tapLetter(id, ch)}
              style={[styles.letterTile, used && styles.letterTileUsed]}
              activeOpacity={0.8}
            >
              <Text style={[styles.letterTileText, used && styles.letterTileTextUsed]}>{ch.toUpperCase()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.exitBtn} onPress={onExit} hitSlop={10}>
        <Text style={styles.exitText}>סיום</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
}

function Done({ text, onAgain, onExit, againLabel }: { text: string; onAgain: () => void; onExit: () => void; againLabel: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.bigEmoji}>🎉</Text>
      <Text style={styles.doneTitle}>כל הכבוד!</Text>
      <Text style={styles.doneText}>{text}</Text>
      <TouchableOpacity style={styles.practiceBtn} onPress={onAgain} activeOpacity={0.85}>
        <Text style={styles.practiceBtnText}>{againLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.exitBtn} onPress={onExit} hitSlop={10}>
        <Text style={styles.exitText}>חזרה לרשימה</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { color: colors.primarySoft, fontSize: 17, fontWeight: '600' },

  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 4 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyHint: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowWord: { color: colors.text, fontSize: 18, fontWeight: '700', textTransform: 'capitalize', textAlign: 'right' },
  rowTr: { color: colors.primarySoft, fontSize: 15, marginTop: 2, textAlign: 'right' },
  rowSong: { color: colors.textFaint, fontSize: 12, marginTop: 4, textAlign: 'right' },
  remove: { color: colors.textFaint, fontSize: 18, paddingHorizontal: spacing.sm },
  speak: { fontSize: 20, paddingHorizontal: spacing.sm },

  // Framed bottom panel that holds the game buttons.
  practiceBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  practiceTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'center' },
  practiceRow: { flexDirection: 'row', gap: spacing.sm },
  gameBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: 4, alignItems: 'center' },
  gameBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  btnDisabled: { backgroundColor: colors.surfaceLight },
  hintSmall: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  practiceBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' },
  practiceBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Memory game
  matchWrap: { flex: 1, padding: spacing.lg },
  matchHint: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: spacing.lg },
  matchCols: { flexDirection: 'row', gap: spacing.md, flex: 1 },
  matchCol: { flex: 1, gap: spacing.sm },
  tile: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 16, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  tileSel: { borderColor: colors.primary, backgroundColor: colors.surfaceLight },
  tileGone: { opacity: 0 },
  tileWrong: { borderColor: colors.danger, backgroundColor: colors.danger + '33' },
  tileCorrect: { borderColor: colors.success, backgroundColor: colors.success + '33' },
  tileText: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  tileTextDim: { color: colors.textMuted },

  // Spell game
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  progress: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.md },
  spellClue: { color: colors.primarySoft, fontSize: 26, fontWeight: '800', marginBottom: spacing.xl },
  boxesWrap: { position: 'relative', width: '100%', alignItems: 'center', marginBottom: spacing.md },
  boxes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  box: { width: 40, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  boxBlank: { backgroundColor: colors.surface, borderColor: colors.surfaceLight },
  boxNext: { borderColor: colors.primary },
  boxRight: { borderColor: colors.success },
  boxWrong: { borderColor: colors.danger },
  boxText: { color: colors.text, fontSize: 22, fontWeight: '800' },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  spellHint: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.md },

  letterPool: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: spacing.lg, maxWidth: 320 },
  letterTile: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  letterTileUsed: { backgroundColor: colors.surfaceLight, opacity: 0.35 },
  letterTileText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  letterTileTextUsed: { color: colors.textFaint },

  // Live XP bar shown during games
  xpBarWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  xpBarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  xpBarLevel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  xpBarXp: { color: colors.primarySoft, fontSize: 13, fontWeight: '600' },
  xpBarTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceLight, overflow: 'hidden' },
  xpBarFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },

  exitBtn: { marginTop: spacing.xl },
  exitText: { color: colors.textMuted, fontSize: 15 },
  bigEmoji: { fontSize: 64, marginBottom: spacing.md },
  doneTitle: { color: colors.text, fontSize: 26, fontWeight: '800' },
  doneText: { color: colors.textMuted, fontSize: 16, marginTop: spacing.sm, marginBottom: spacing.xl },
});
