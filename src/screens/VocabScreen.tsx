import { useState, useEffect, useMemo } from 'react';
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getVocab, removeWord, VocabWord } from '../vocab';
import { getSentences, removeSentence, SentenceItem } from '../sentences';
import { award, getProgress, getLevel, xpIntoLevel, XP_PER_LEVEL, onXpGain } from '../progress';
import { speakWord } from '../speech';
import { recordResult, weightedSample, weightedQueue } from '../srs';
import { colors, fonts, radius, spacing } from '../theme';

// Padding words for the sentence game's multiple-choice when there aren't
// enough other saved sentences yet to draw wrong options from.
const FALLBACK_WORDS = ['happy', 'light', 'water', 'people', 'music', 'house', 'place', 'world', 'friend', 'night'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Mode = 'list' | 'memory' | 'spell' | 'listen' | 'truefalse' | 'allGames' | 'fillSentence';
type Tab = 'words' | 'sentences';

// Cross-platform "are you sure?" confirmation before a destructive action.
function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export default function VocabScreen({ navigation }: any) {
  const [words, setWords] = useState<VocabWord[]>(getVocab());
  const [sentences, setSentences] = useState<SentenceItem[]>(getSentences());
  const [mode, setMode] = useState<Mode>('list');
  const [tab, setTab] = useState<Tab>('words');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (mode === 'list' ? navigation.goBack() : setMode('list'))} hitSlop={12}>
          <Text style={styles.back}>
            ‹ {mode === 'list' ? 'Back' : tab === 'words' ? 'אוצר המילים' : 'משפטים שמורים'}
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'list' && (
        <>
          <TabBar tab={tab} setTab={setTab} />
          {tab === 'words' ? (
            <ListView
              words={words}
              onRemove={(w) => { removeWord(w); setWords(getVocab()); }}
              onMemory={() => setMode('memory')}
              onSpell={() => setMode('spell')}
              onListen={() => setMode('listen')}
              onTrueFalse={() => setMode('truefalse')}
              onAllGames={() => setMode('allGames')}
            />
          ) : (
            <SentenceListView
              sentences={sentences}
              onRemove={(id) => { removeSentence(id); setSentences(getSentences()); }}
              onFillSentence={() => setMode('fillSentence')}
            />
          )}
        </>
      )}
      {mode === 'memory' && <Memory words={words} onExit={() => setMode('list')} />}
      {mode === 'spell' && <Spell words={words} onExit={() => setMode('list')} />}
      {mode === 'listen' && <Listen words={words} onExit={() => setMode('list')} />}
      {mode === 'truefalse' && <TrueFalse words={words} onExit={() => setMode('list')} />}
      {mode === 'allGames' && (
        <AllGames
          words={words}
          onMemory={() => setMode('memory')}
          onSpell={() => setMode('spell')}
          onListen={() => setMode('listen')}
          onTrueFalse={() => setMode('truefalse')}
        />
      )}
      {mode === 'fillSentence' && <FillSentence sentences={sentences} onExit={() => setMode('list')} />}
    </SafeAreaView>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity style={[styles.tabBtn, tab === 'words' && styles.tabBtnActive]} onPress={() => setTab('words')} activeOpacity={0.8}>
        <Text style={[styles.tabBtnText, tab === 'words' && styles.tabBtnTextActive]}>📚 מילים</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tabBtn, tab === 'sentences' && styles.tabBtnActive]} onPress={() => setTab('sentences')} activeOpacity={0.8}>
        <Text style={[styles.tabBtnText, tab === 'sentences' && styles.tabBtnTextActive]}>📝 משפטים</Text>
      </TouchableOpacity>
    </View>
  );
}

function ListView({
  words,
  onRemove,
  onMemory,
  onSpell,
  onListen,
  onTrueFalse,
  onAllGames,
}: {
  words: VocabWord[];
  onRemove: (w: string) => void;
  onMemory: () => void;
  onSpell: () => void;
  onListen: () => void;
  onTrueFalse: () => void;
  onAllGames: () => void;
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
              <TouchableOpacity
                onPress={() => confirmAction('מחיקת מילה', `למחוק את המילה "${item.word}" מאוצר המילים?`, () => onRemove(item.word))}
                hitSlop={10}
              >
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
          <GameGrid words={words} onMemory={onMemory} onSpell={onSpell} onListen={onListen} onTrueFalse={onTrueFalse} />
          {words.length < 4 && <Text style={styles.hintSmall}>למשחק הזכרון צריך 3+ מילים, למשחק ההאזנה 4+ מילים</Text>}

          <TouchableOpacity style={styles.allGamesBtn} onPress={onAllGames} activeOpacity={0.85}>
            <Text style={styles.allGamesBtnText}>🎮  עוד משחקים</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

// Saved full sentences/lines from songs — a parallel vocabulary to single
// words, for memorizing whole phrases instead of just one word at a time.
function SentenceListView({
  sentences,
  onRemove,
  onFillSentence,
}: {
  sentences: SentenceItem[];
  onRemove: (id: string) => void;
  onFillSentence: () => void;
}) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>📝 משפטים שמורים</Text>
        <Text style={styles.subtitle}>{sentences.length} משפטים שמורים</Text>
      </View>

      {sentences.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>עוד לא שמרת משפטים.</Text>
          <Text style={styles.emptyHint}>בתוך שיר, לחץ על הכוכב ☆ ליד שורה כדי לשמור את כל המשפט כאן.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={sentences}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => confirmAction('מחיקת משפט', 'למחוק את המשפט הזה מהרשימה?', () => onRemove(item.id))}
                hitSlop={10}
              >
                <Text style={styles.remove}>✕</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.sentenceRowText}>{item.text}</Text>
                <Text style={styles.rowTr}>{item.translation}</Text>
                {item.song ? <Text style={styles.rowSong}>🎵 {item.song}</Text> : null}
              </View>
            </View>
          )}
        />
      )}

      {sentences.length > 0 && (
        <View style={styles.practiceBar}>
          <Text style={styles.practiceTitle}>תרגול</Text>
          <TouchableOpacity style={styles.gameBtn} onPress={onFillSentence} activeOpacity={0.85}>
            <Text style={styles.gameBtnText}>✍️  השלם את המשפט</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

// The 4 main practice games, shown both on the vocab list and the "all games" page.
function GameGrid({
  words,
  onMemory,
  onSpell,
  onListen,
  onTrueFalse,
}: {
  words: VocabWord[];
  onMemory: () => void;
  onSpell: () => void;
  onListen: () => void;
  onTrueFalse: () => void;
}) {
  return (
    <View style={styles.gameGrid}>
      <TouchableOpacity
        style={[styles.gameBtn, styles.gameBtnGrid, words.length < 3 && styles.btnDisabled]}
        onPress={words.length < 3 ? undefined : onMemory}
        activeOpacity={0.85}
      >
        <Text style={styles.gameBtnText}>🧠  משחק הזכרון</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.gameBtn, styles.gameBtnGrid]} onPress={onSpell} activeOpacity={0.85}>
        <Text style={styles.gameBtnText}>✏️  השלמת מילה</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.gameBtn, styles.gameBtnGrid, words.length < 4 && styles.btnDisabled]}
        onPress={words.length < 4 ? undefined : onListen}
        activeOpacity={0.85}
      >
        <Text style={styles.gameBtnText}>🎧  משחק האזנה</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.gameBtn, styles.gameBtnGrid]} onPress={onTrueFalse} activeOpacity={0.85}>
        <Text style={styles.gameBtnText}>✅  נכון או לא נכון</Text>
      </TouchableOpacity>
    </View>
  );
}

// Dedicated page for all the games, opened from the prominent "more games" button.
function AllGames({
  words,
  onMemory,
  onSpell,
  onListen,
  onTrueFalse,
}: {
  words: VocabWord[];
  onMemory: () => void;
  onSpell: () => void;
  onListen: () => void;
  onTrueFalse: () => void;
}) {
  return (
    <View style={styles.allGamesPage}>
      <Text style={styles.title}>🎮 כל המשחקים</Text>
      <Text style={styles.subtitle}>תרגול אוצר המילים שלך</Text>
      <View style={{ marginTop: spacing.lg }}>
        <GameGrid words={words} onMemory={onMemory} onSpell={onSpell} onListen={onListen} onTrueFalse={onTrueFalse} />
      </View>
      {words.length < 4 && <Text style={styles.hintSmall}>למשחק הזכרון צריך 3+ מילים, למשחק ההאזנה 4+ מילים</Text>}
    </View>
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
    () => weightedSample(words, Math.min(BATCH, words.length), (w) => w.word),
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
      recordResult(word, true);
      setTimeout(() => {
        setJustMatched((j) => j.filter((w) => w !== word));
        setMatched((m) => [...m, word]);
      }, 500);
    } else {
      setWrong(word);
      setSel(null);
      award(false, 0);
      recordResult(word, false);
      if (sel.word !== word) recordResult(sel.word, false);
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
  const queue = useMemo(() => weightedQueue(words, (w) => w.word), [words]);
  const [pos, setPos] = useState(0);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<'typing' | 'right' | 'wrong'>('typing');

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
  }, [pos]);

  // Shrink the letter boxes for long words so the whole word always fits
  // on one row instead of wrapping to a second line.
  const wordLen = card?.word.length || 1;
  const boxSize = Math.max(20, Math.min(40, Math.floor((300 - (wordLen - 1) * 6) / wordLen)));
  const boxFontSize = boxSize < 28 ? 15 : 22;

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
        recordResult(card.word, true);
        setTimeout(() => setPos((p) => p + 1), 700);
      } else {
        setStatus('wrong');
        award(false, 0);
        recordResult(card.word, false);
        setTimeout(() => { setTyped(''); setStatus('typing'); setUsedIds([]); }, 700);
      }
    }
  }

  function tapLetter(id: number, ch: string) {
    if (status !== 'typing' || usedIds.includes(id)) return;
    setUsedIds((u) => [...u, id]);
    onType(typed + ch);
  }

  // Tapping a filled box removes that letter (and any placed after it),
  // freeing its tile back to the pool — an easy way to undo a wrong pick.
  function removeFrom(blankIndex: number) {
    if (status !== 'typing' || blankIndex >= typed.length) return;
    setTyped((t) => t.slice(0, blankIndex));
    setUsedIds((u) => u.slice(0, blankIndex));
  }

  return (
    <View style={{ flex: 1 }}>
      <LiveXpBar />
      <View style={styles.center}>
      <Text style={styles.progress}>{pos + 1} / {queue.length}</Text>
      <View style={styles.spellClueRow}>
        <Text style={styles.spellClue}>{card.translation}</Text>
        <TouchableOpacity onPress={() => speakWord(card.word)} hitSlop={10}>
          <Text style={styles.spellSpeak}>🔊</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.boxes}>
        {card.word.split('').map((ch, i) => {
          const blankIndex = blanks.indexOf(i);
          const isBlank = blankIndex !== -1;
          const typedChar = isBlank ? typed[blankIndex] : '';
          const isNext = isBlank && blankIndex === typed.length && status === 'typing';
          const filled = isBlank && blankIndex < typed.length;
          const show = isBlank ? (typedChar || '') : ch;
          return (
            <TouchableOpacity
              key={i}
              disabled={!filled || status !== 'typing'}
              onPress={() => removeFrom(blankIndex)}
              activeOpacity={filled ? 0.6 : 1}
              style={[
                styles.box,
                { width: boxSize, height: boxSize + 8 },
                isBlank && styles.boxBlank,
                isNext && styles.boxNext,
                status === 'right' && styles.boxRight,
                status === 'wrong' && isBlank && styles.boxWrong,
              ]}
            >
              <Text style={[styles.boxText, { fontSize: boxFontSize }]}>{show.toUpperCase()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.spellHint}>לחץ על האותיות החסרות (ולחיצה על אות שמולאה תמחק אותה) ⌨️</Text>

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

// Listening game: hear the word spoken, then pick its translation among
// a few decoys.
function Listen({ words, onExit }: { words: VocabWord[]; onExit: () => void }) {
  const queue = useMemo(() => weightedQueue(words, (w) => w.word), [words]);
  const [pos, setPos] = useState(0);
  const [status, setStatus] = useState<'choosing' | 'right' | 'wrong'>('choosing');
  const [picked, setPicked] = useState<string | null>(null);

  const card = queue[pos];

  const options = useMemo(() => {
    if (!card) return [] as VocabWord[];
    const others = shuffle(words.filter((w) => w.word !== card.word)).slice(0, 3);
    return shuffle([card, ...others]);
  }, [card]);

  useEffect(() => {
    setStatus('choosing');
    setPicked(null);
    if (card) speakWord(card.word);
  }, [pos, card]);

  if (!card || pos >= queue.length) {
    return <Done text="סיימת את משחק ההאזנה!" onAgain={() => setPos(0)} onExit={onExit} againLabel="🔁  עוד פעם" />;
  }

  function choose(opt: VocabWord) {
    if (status !== 'choosing') return;
    setPicked(opt.word);
    const ok = opt.word === card.word;
    setStatus(ok ? 'right' : 'wrong');
    award(ok, 12, card.word);
    recordResult(card.word, ok);
    setTimeout(() => setPos((p) => p + 1), 900);
  }

  return (
    <View style={{ flex: 1 }}>
      <LiveXpBar />
      <View style={styles.center}>
        <Text style={styles.progress}>{pos + 1} / {queue.length}</Text>
        <Text style={styles.listenHint}>איזו מילה שמעת?</Text>
        <TouchableOpacity style={styles.listenBtn} onPress={() => speakWord(card.word)} activeOpacity={0.8}>
          <Text style={styles.listenBtnText}>🔊  השמע שוב</Text>
        </TouchableOpacity>

        <View style={styles.listenOptions}>
          {options.map((opt) => {
            const isPicked = picked === opt.word;
            const isRight = opt.word === card.word;
            return (
              <TouchableOpacity
                key={opt.word}
                style={[
                  styles.listenOption,
                  status !== 'choosing' && isRight && styles.tileCorrect,
                  status === 'wrong' && isPicked && styles.tileWrong,
                ]}
                onPress={() => choose(opt)}
                disabled={status !== 'choosing'}
                activeOpacity={0.85}
              >
                <Text style={styles.listenOptionText}>{opt.translation}</Text>
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

// True/false game: see the English word and a Hebrew translation that's
// either correct or swapped with a wrong one — decide which.
function TrueFalse({ words, onExit }: { words: VocabWord[]; onExit: () => void }) {
  const queue = useMemo(() => weightedQueue(words, (w) => w.word), [words]);
  const [pos, setPos] = useState(0);
  const [status, setStatus] = useState<'choosing' | 'right' | 'wrong'>('choosing');
  const [picked, setPicked] = useState<'yes' | 'no' | null>(null);

  const card = queue[pos];

  // Decide up front, for the whole round, exactly which half of the
  // questions will show a wrong translation — then shuffle that pattern.
  // (Flipping an independent coin per question can "feel" rigged when it
  // happens to land true several times in a row, even though it's fair.)
  const falsePattern = useMemo(() => {
    const n = queue.length;
    const pattern = Array.from({ length: n }, (_, i) => i < Math.floor(n / 2));
    return shuffle(pattern);
  }, [queue]);

  // Pick this card's wrong translation once (stable per card+pattern), or
  // fall back to true if there's no other distinct translation to borrow.
  const shown = useMemo(() => {
    if (!card) return { translation: '', isTrue: true };
    const wantWrong = falsePattern[pos];
    const others = words.filter((w) => w.word !== card.word && w.translation !== card.translation);
    if (!wantWrong || others.length === 0) return { translation: card.translation, isTrue: true };
    const wrong = others[Math.floor(Math.random() * others.length)];
    return { translation: wrong.translation, isTrue: false };
  }, [card, pos, falsePattern]);

  useEffect(() => {
    setStatus('choosing');
    setPicked(null);
  }, [pos, card]);

  if (!card || pos >= queue.length) {
    return <Done text="סיימת את כל המילים!" onAgain={() => setPos(0)} onExit={onExit} againLabel="🔁  עוד פעם" />;
  }

  function answer(yes: boolean) {
    if (status !== 'choosing') return;
    setPicked(yes ? 'yes' : 'no');
    const ok = yes === shown.isTrue;
    setStatus(ok ? 'right' : 'wrong');
    award(ok, 12, card.word);
    recordResult(card.word, ok);
    setTimeout(() => setPos((p) => p + 1), 800);
  }

  return (
    <View style={{ flex: 1 }}>
      <LiveXpBar />
      <View style={styles.center}>
        <Text style={styles.progress}>{pos + 1} / {queue.length}</Text>
        <View style={styles.spellClueRow}>
          <Text style={styles.tfWord}>{card.word}</Text>
          <TouchableOpacity onPress={() => speakWord(card.word)} hitSlop={10}>
            <Text style={styles.spellSpeak}>🔊</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.tfHint}>האם התרגום הזה נכון?</Text>
        <View style={styles.tfCard}>
          <Text style={styles.tfTranslation}>{shown.translation}</Text>
        </View>

        <View style={styles.tfRow}>
          <TouchableOpacity
            style={[
              styles.tfBtn,
              status !== 'choosing' && picked === 'yes' && (status === 'right' ? styles.tileCorrect : styles.tileWrong),
            ]}
            onPress={() => answer(true)}
            disabled={status !== 'choosing'}
            activeOpacity={0.85}
          >
            <Text style={styles.tfBtnText}>✅ נכון</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tfBtn,
              status !== 'choosing' && picked === 'no' && (status === 'right' ? styles.tileCorrect : styles.tileWrong),
            ]}
            onPress={() => answer(false)}
            disabled={status !== 'choosing'}
            activeOpacity={0.85}
          >
            <Text style={styles.tfBtnText}>❌ לא נכון</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.exitBtn} onPress={onExit} hitSlop={10}>
          <Text style={styles.exitText}>סיום</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Fill-in-the-blank game: a saved song sentence with one word blanked out;
// pick the missing word from a few options.
function FillSentence({ sentences, onExit }: { sentences: SentenceItem[]; onExit: () => void }) {
  const queue = useMemo(() => shuffle(sentences), [sentences]);
  const [pos, setPos] = useState(0);
  const [status, setStatus] = useState<'choosing' | 'right' | 'wrong'>('choosing');
  const [picked, setPicked] = useState<string | null>(null);

  const card = queue[pos];

  const round = useMemo(() => {
    if (!card) return null;
    const tokens = card.text.split(/\s+/);
    const candidates = tokens
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.replace(/[^a-zA-Z']/g, '').length >= 3);
    const pick = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : { t: tokens[0], i: 0 };
    const answer = pick.t.replace(/[^a-zA-Z']/g, '');
    const sentence = tokens.map((t, i) => (i === pick.i ? '_____' : t)).join(' ');

    // Wrong options: words from other saved sentences, padded with a small
    // fallback list if there aren't enough yet.
    const pool = new Set<string>();
    sentences.forEach((s) => {
      if (s.id === card.id) return;
      s.text.split(/\s+/).forEach((w) => {
        const clean = w.replace(/[^a-zA-Z']/g, '');
        if (clean.length >= 3 && clean.toLowerCase() !== answer.toLowerCase()) pool.add(clean);
      });
    });
    FALLBACK_WORDS.forEach((w) => {
      if (w.toLowerCase() !== answer.toLowerCase()) pool.add(w);
    });
    const decoys = shuffle(Array.from(pool)).slice(0, 3);
    const options = shuffle([answer, ...decoys]);
    return { sentence, answer, options };
  }, [card]);

  useEffect(() => {
    setStatus('choosing');
    setPicked(null);
  }, [pos, card]);

  if (!card || pos >= queue.length || !round) {
    return <Done text="סיימת את כל המשפטים!" onAgain={() => setPos(0)} onExit={onExit} againLabel="🔁  עוד פעם" />;
  }

  function choose(opt: string) {
    if (status !== 'choosing') return;
    setPicked(opt);
    const ok = opt.toLowerCase() === round!.answer.toLowerCase();
    setStatus(ok ? 'right' : 'wrong');
    award(ok, 15, round!.answer);
    setTimeout(() => setPos((p) => p + 1), 900);
  }

  return (
    <View style={{ flex: 1 }}>
      <LiveXpBar />
      <View style={styles.center}>
        <Text style={styles.progress}>{pos + 1} / {queue.length}</Text>
        <Text style={styles.sentenceClue}>{card.translation}</Text>
        <View style={styles.sentenceCard}>
          <Text style={styles.sentenceText}>{round.sentence}</Text>
        </View>

        <View style={styles.listenOptions}>
          {round.options.map((opt) => {
            const isPicked = picked === opt;
            const isRight = opt.toLowerCase() === round.answer.toLowerCase();
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.listenOption,
                  status !== 'choosing' && isRight && styles.tileCorrect,
                  status === 'wrong' && isPicked && styles.tileWrong,
                ]}
                onPress={() => choose(opt)}
                disabled={status !== 'choosing'}
                activeOpacity={0.85}
              >
                <Text style={styles.listenOptionText}>{opt}</Text>
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
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primarySoft, fontSize: 20, fontFamily: fonts.bold },

  tabBar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.surface },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: { color: colors.textMuted, fontSize: 15, fontFamily: fonts.bold },
  tabBtnTextActive: { color: '#fff' },

  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 28, fontFamily: fonts.display },
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
  sentenceRowText: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'right' },
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
  practiceTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.display, marginBottom: spacing.sm, textAlign: 'center' },
  practiceRow: { flexDirection: 'row', gap: spacing.sm },
  gameGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  gameBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: 4, alignItems: 'center' },
  gameBtnGrid: { flexBasis: '47%', flexGrow: 0 },
  gameBtnText: { color: '#fff', fontSize: 15, fontFamily: fonts.extraBold, textAlign: 'center' },
  btnDisabled: { backgroundColor: colors.surfaceLight },
  hintSmall: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  allGamesBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
  },
  allGamesBtnText: { color: '#fff', fontSize: 17, fontFamily: fonts.extraBold },
  allGamesPage: { flex: 1, padding: spacing.lg },
  practiceBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    minWidth: 220,
    alignItems: 'center',
  },
  practiceBtnText: { color: '#fff', fontSize: 18, fontFamily: fonts.extraBold, textAlign: 'center' },

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
  spellClueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  spellClue: { color: colors.primarySoft, fontSize: 26, fontWeight: '800' },
  spellSpeak: { fontSize: 24 },
  boxes: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center', gap: 6, marginBottom: spacing.md },
  box: { width: 40, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  boxBlank: { backgroundColor: colors.surface, borderColor: colors.surfaceLight },
  boxNext: { borderColor: colors.primary },
  boxRight: { borderColor: colors.success },
  boxWrong: { borderColor: colors.danger },
  boxText: { color: colors.text, fontSize: 22, fontWeight: '800' },
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

  // Listening game
  listenHint: { color: colors.textMuted, fontSize: 16, marginBottom: spacing.lg },
  listenBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: spacing.xl, marginBottom: spacing.xl },
  listenBtnText: { color: '#fff', fontSize: 16, fontFamily: fonts.extraBold },
  listenOptions: { width: '100%', gap: spacing.sm },
  listenOption: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  listenOptionText: { color: colors.text, fontSize: 18, fontWeight: '700' },

  // True/false game
  tfWord: { color: colors.text, fontSize: 28, fontWeight: '800', textTransform: 'capitalize' },
  tfHint: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.md },
  tfCard: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 20, paddingHorizontal: spacing.xl, marginBottom: spacing.xl, minWidth: 200, alignItems: 'center' },
  tfTranslation: { color: colors.primarySoft, fontSize: 24, fontWeight: '800' },
  tfRow: { flexDirection: 'row', gap: spacing.md },
  tfBtn: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 16, paddingHorizontal: spacing.lg, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  tfBtnText: { color: colors.text, fontSize: 17, fontFamily: fonts.bold },

  // Fill-in-the-sentence game
  sentenceClue: { color: colors.primarySoft, fontSize: 20, fontWeight: '700', marginBottom: spacing.lg, textAlign: 'center' },
  sentenceCard: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 20, paddingHorizontal: spacing.lg, marginBottom: spacing.xl, alignItems: 'center' },
  sentenceText: { color: colors.text, fontSize: 19, fontWeight: '700', textAlign: 'center' },

  exitBtn: {
    marginTop: spacing.xl,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.surfaceLight,
    backgroundColor: colors.surface,
  },
  exitText: { color: colors.text, fontSize: 14, fontFamily: fonts.bold },
  bigEmoji: { fontSize: 64, marginBottom: spacing.md },
  doneTitle: { color: colors.text, fontSize: 28, fontFamily: fonts.display },
  doneText: { color: colors.textMuted, fontSize: 16, marginTop: spacing.sm, marginBottom: spacing.xl },
});
