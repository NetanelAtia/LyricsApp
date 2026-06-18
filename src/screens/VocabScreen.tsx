import { useState, useEffect, useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getVocab, removeWord, VocabWord } from '../vocab';
import { colors, radius, spacing } from '../theme';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Mode = 'list' | 'cards' | 'match';

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
          onCards={() => setMode('cards')}
          onMatch={() => setMode('match')}
        />
      )}
      {mode === 'cards' && <Flashcards words={words} onExit={() => setMode('list')} />}
      {mode === 'match' && <Matching words={words} onExit={() => setMode('list')} />}
    </SafeAreaView>
  );
}

function ListView({
  words,
  onRemove,
  onCards,
  onMatch,
}: {
  words: VocabWord[];
  onRemove: (w: string) => void;
  onCards: () => void;
  onMatch: () => void;
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
          data={words}
          keyExtractor={(w) => w.word}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 130 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowWord}>{item.word}</Text>
                <Text style={styles.rowTr}>{item.translation}</Text>
              </View>
              <TouchableOpacity onPress={() => onRemove(item.word)} hitSlop={10}>
                <Text style={styles.remove}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {words.length > 0 && (
        <View style={styles.practiceBar}>
          <TouchableOpacity
            style={[styles.practiceBtn, words.length < 3 && styles.btnDisabled]}
            onPress={words.length < 3 ? undefined : onMatch}
            activeOpacity={0.85}
          >
            <Text style={styles.practiceBtnText}>🧩  משחק התאמה</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.practiceBtnAlt} onPress={onCards} activeOpacity={0.85}>
            <Text style={styles.practiceBtnAltText}>🃏  כרטיסיות</Text>
          </TouchableOpacity>
          {words.length < 3 && <Text style={styles.hintSmall}>למשחק ההתאמה צריך לפחות 3 מילים</Text>}
        </View>
      )}
    </>
  );
}

// Matching game: tap an English word, then its Hebrew translation. Match = green.
function Matching({ words, onExit }: { words: VocabWord[]; onExit: () => void }) {
  const BATCH = 6;
  const [round, setRound] = useState(0);
  const roundWords = useMemo(
    () => shuffle(words).slice(0, Math.min(BATCH, words.length)),
    [round, words]
  );

  const [left, setLeft] = useState<VocabWord[]>([]);
  const [right, setRight] = useState<VocabWord[]>([]);
  const [selLeft, setSelLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);

  useEffect(() => {
    setLeft(shuffle(roundWords));
    setRight(shuffle(roundWords));
    setSelLeft(null);
    setMatched([]);
    setWrong(null);
  }, [roundWords]);

  const allMatched = roundWords.length > 0 && matched.length === roundWords.length;

  function tapLeft(w: string) {
    if (matched.includes(w)) return;
    setWrong(null);
    setSelLeft(w);
  }
  function tapRight(w: string) {
    if (matched.includes(w) || !selLeft) return;
    if (selLeft === w) {
      setMatched((m) => [...m, w]);
      setSelLeft(null);
    } else {
      setWrong(w);
      setSelLeft(null);
      setTimeout(() => setWrong(null), 600);
    }
  }

  if (allMatched) {
    return (
      <View style={styles.center}>
        <Text style={styles.bigEmoji}>🎉</Text>
        <Text style={styles.doneTitle}>כל הכבוד!</Text>
        <Text style={styles.doneText}>התאמת את כל המילים בסבב.</Text>
        <TouchableOpacity style={styles.practiceBtn} onPress={() => setRound((r) => r + 1)} activeOpacity={0.85}>
          <Text style={styles.practiceBtnText}>🔁  סבב נוסף</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exitBtn} onPress={onExit} hitSlop={10}>
          <Text style={styles.exitText}>חזרה לרשימה</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.matchWrap}>
      <Text style={styles.matchHint}>התאם כל מילה לתרגום שלה</Text>
      <View style={styles.matchCols}>
        <View style={styles.matchCol}>
          {left.map((w) => {
            const isMatched = matched.includes(w.word);
            const isSel = selLeft === w.word;
            return (
              <TouchableOpacity
                key={w.word}
                style={[styles.tile, isSel && styles.tileSel, isMatched && styles.tileMatched]}
                onPress={() => tapLeft(w.word)}
                disabled={isMatched}
                activeOpacity={0.8}
              >
                <Text style={[styles.tileText, isMatched && styles.tileTextDim]}>{w.word}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.matchCol}>
          {right.map((w) => {
            const isMatched = matched.includes(w.word);
            const isWrong = wrong === w.word;
            return (
              <TouchableOpacity
                key={w.word}
                style={[styles.tile, isWrong && styles.tileWrong, isMatched && styles.tileMatched]}
                onPress={() => tapRight(w.word)}
                disabled={isMatched}
                activeOpacity={0.8}
              >
                <Text style={[styles.tileText, isMatched && styles.tileTextDim]}>{w.translation}</Text>
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

// Flashcards: reveal the Hebrew, mark known / not yet (unknowns repeat).
function Flashcards({ words, onExit }: { words: VocabWord[]; onExit: () => void }) {
  const [queue, setQueue] = useState<VocabWord[]>(() => shuffle(words));
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knownCount, setKnownCount] = useState(0);

  const done = pos >= queue.length;
  const card = queue[pos];

  function known() { setKnownCount((c) => c + 1); setRevealed(false); setPos((p) => p + 1); }
  function notYet() { setQueue((q) => [...q, q[pos]]); setRevealed(false); setPos((p) => p + 1); }
  function restart() { setQueue(shuffle(words)); setPos(0); setRevealed(false); setKnownCount(0); }

  if (done) {
    return (
      <View style={styles.center}>
        <Text style={styles.bigEmoji}>🎉</Text>
        <Text style={styles.doneTitle}>כל הכבוד!</Text>
        <Text style={styles.doneText}>ידעת {knownCount} כרטיסיות בסבב הזה.</Text>
        <TouchableOpacity style={styles.practiceBtn} onPress={restart} activeOpacity={0.85}>
          <Text style={styles.practiceBtnText}>🔁  עוד פעם</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exitBtn} onPress={onExit} hitSlop={10}>
          <Text style={styles.exitText}>חזרה לרשימה</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.progress}>{pos + 1} / {queue.length}</Text>
      <View style={styles.card}>
        <Text style={styles.cardWord}>{card.word}</Text>
        {revealed && <Text style={styles.cardTr}>{card.translation}</Text>}
      </View>
      {!revealed ? (
        <TouchableOpacity style={styles.revealBtn} onPress={() => setRevealed(true)} activeOpacity={0.85}>
          <Text style={styles.revealText}>הצג תרגום</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.judgeRow}>
          <TouchableOpacity style={[styles.judgeBtn, styles.notYet]} onPress={notYet} activeOpacity={0.85}>
            <Text style={styles.judgeText}>עוד לא ✗</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.judgeBtn, styles.knew]} onPress={known} activeOpacity={0.85}>
            <Text style={styles.judgeText}>ידעתי ✓</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={styles.exitBtn} onPress={onExit} hitSlop={10}>
        <Text style={styles.exitText}>סיום</Text>
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
  rowWord: { color: colors.text, fontSize: 18, fontWeight: '700', textTransform: 'capitalize', textAlign: 'left' },
  rowTr: { color: colors.primarySoft, fontSize: 15, marginTop: 2, textAlign: 'left' },
  remove: { color: colors.textFaint, fontSize: 18, paddingHorizontal: spacing.sm },

  practiceBar: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: spacing.sm },
  practiceBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' },
  practiceBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  practiceBtnAlt: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  practiceBtnAltText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  btnDisabled: { backgroundColor: colors.surfaceLight },
  hintSmall: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },

  // Matching game
  matchWrap: { flex: 1, padding: spacing.lg },
  matchHint: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginBottom: spacing.lg },
  matchCols: { flexDirection: 'row', gap: spacing.md, flex: 1 },
  matchCol: { flex: 1, gap: spacing.sm },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSel: { borderColor: colors.primary, backgroundColor: colors.surfaceLight },
  tileMatched: { backgroundColor: colors.success + '33', borderColor: colors.success },
  tileWrong: { borderColor: colors.danger, backgroundColor: colors.danger + '33' },
  tileText: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  tileTextDim: { color: colors.textMuted },

  // Flashcards
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  progress: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.lg },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 48,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  cardWord: { color: colors.text, fontSize: 34, fontWeight: '800', textTransform: 'capitalize' },
  cardTr: { color: colors.primarySoft, fontSize: 26, fontWeight: '700', marginTop: spacing.md },
  revealBtn: { backgroundColor: colors.surfaceLight, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: spacing.xl },
  revealText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  judgeRow: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  judgeBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' },
  notYet: { backgroundColor: colors.danger },
  knew: { backgroundColor: colors.success },
  judgeText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  exitBtn: { marginTop: spacing.xl },
  exitText: { color: colors.textMuted, fontSize: 15 },
  bigEmoji: { fontSize: 64, marginBottom: spacing.md },
  doneTitle: { color: colors.text, fontSize: 26, fontWeight: '800' },
  doneText: { color: colors.textMuted, fontSize: 16, marginTop: spacing.sm, marginBottom: spacing.xl },
});
