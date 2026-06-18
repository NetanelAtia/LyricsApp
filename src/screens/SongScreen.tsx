import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { songs, normalizeWord, translateWord } from '../data/songs';
import { speakLine, speakWord, stopSpeaking } from '../speech';

export default function SongScreen({ route, navigation }: any) {
  const song = songs.find((s) => s.id === route.params.songId)!;

  // Which exact word is tapped (line+word index, so duplicates don't both light up).
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState('');
  // Toggle: show the full Hebrew translation under each line.
  const [showTranslation, setShowTranslation] = useState(false);
  // Which line + word is currently being read aloud (for the karaoke highlight).
  const [speakingLine, setSpeakingLine] = useState<number | null>(null);
  const [speakingWord, setSpeakingWord] = useState<number | null>(null);
  // Which individual lines have their translation open (per-line 🌐 button).
  const [openLines, setOpenLines] = useState<Record<number, boolean>>({});

  function toggleLine(i: number) {
    setOpenLines((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  // Stop any speech when leaving the screen.
  useEffect(() => () => stopSpeaking(), []);

  function handleWordPress(rawWord: string, key: string) {
    // Tapping the same word again closes the bubble.
    if (selectedKey === key) {
      setSelectedKey(null);
      return;
    }
    const translation = translateWord(song, rawWord);
    setSelectedKey(key);
    setSelectedTranslation(translation ?? '— אין תרגום עדיין —');
  }

  // Read the song line by line — each line is spoken smoothly and fully,
  // while the word currently being spoken is highlighted.
  function playSong(fromLine = 0) {
    if (fromLine >= song.lines.length) {
      setSpeakingLine(null);
      setSpeakingWord(null);
      return;
    }
    setSpeakingLine(fromLine);
    setSpeakingWord(0);
    speakLine(song.lines[fromLine], {
      onWord: (wordIndex) => setSpeakingWord(wordIndex),
      onDone: () => playSong(fromLine + 1),
      onStopped: () => {
        setSpeakingLine(null);
        setSpeakingWord(null);
      },
    });
  }

  function stopSong() {
    stopSpeaking();
    setSpeakingLine(null);
    setSpeakingWord(null);
  }

  const isPlaying = speakingLine !== null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      {/* Song header */}
      <View style={styles.songHeader}>
        <View style={[styles.cover, { backgroundColor: song.accent }]}>
          <Text style={styles.coverEmoji}>{song.emoji}</Text>
        </View>
        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.artist}>{song.artist}</Text>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.playBtn, isPlaying && styles.playBtnActive]}
            onPress={isPlaying ? stopSong : () => playSong(0)}
            activeOpacity={0.8}
          >
            <Text style={styles.playBtnText}>{isPlaying ? '■ Stop' : '▶  Play'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, showTranslation && styles.toggleBtnActive]}
            onPress={() => setShowTranslation((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleBtnText, showTranslation && styles.toggleBtnTextActive]}>
              {showTranslation ? '✓ תרגום' : 'הצג תרגום'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lyrics */}
      <ScrollView contentContainerStyle={styles.lyrics}>
        {song.lines.map((line, lineIndex) => (
          <View key={lineIndex} style={styles.lineBlock}>
            <View style={styles.lineRow}>
              <View
                style={[
                  styles.line,
                  speakingLine === lineIndex && styles.lineSpeaking,
                ]}
              >
              {line.split(' ').map((word, wordIndex) => {
                const key = `${lineIndex}-${wordIndex}`;
                const isSelected = selectedKey === key;
                const isSpeaking = speakingLine === lineIndex && speakingWord === wordIndex;
                return (
                  <View key={wordIndex} style={[styles.wordWrap, isSelected && styles.wordWrapActive]}>
                    {/* Translation bubble, positioned above this word */}
                    {isSelected && (
                      <View style={styles.bubbleContainer} pointerEvents="box-none">
                        <View style={styles.bubble}>
                          <TouchableOpacity onPress={() => setSelectedKey(null)} hitSlop={6}>
                            <Text style={styles.bubbleText}>{selectedTranslation}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => speakWord(normalizeWord(word))} hitSlop={8}>
                            <Text style={styles.bubbleSpeak}>🔊</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.bubbleArrow} />
                      </View>
                    )}
                    <TouchableOpacity onPress={() => handleWordPress(word, key)} activeOpacity={0.6}>
                      <Text
                        style={[
                          styles.word,
                          isSelected && styles.wordSelected,
                          isSpeaking && styles.wordSpeaking,
                        ]}
                      >
                        {word}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              </View>

              {/* Small per-line translate button */}
              <TouchableOpacity
                style={styles.lineTranslateBtn}
                onPress={() => toggleLine(lineIndex)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="translate"
                  size={18}
                  color={openLines[lineIndex] ? colors.primarySoft : colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Line translation: shown by the global toggle OR this line's button */}
            {(showTranslation || openLines[lineIndex]) && (
              <Text style={styles.lineHe}>{song.linesHe[lineIndex]}</Text>
            )}
          </View>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { color: colors.primarySoft, fontSize: 17, fontWeight: '600' },

  songHeader: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  cover: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  coverEmoji: { fontSize: 44 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  artist: { color: colors.textMuted, fontSize: 14, marginTop: 2 },

  controls: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  playBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  playBtnActive: { backgroundColor: colors.danger },
  playBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  toggleBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  toggleBtnActive: { backgroundColor: colors.surfaceLight, borderColor: colors.primary },
  toggleBtnText: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  toggleBtnTextActive: { color: colors.text },

  lyrics: { paddingHorizontal: spacing.lg, paddingTop: 56 },
  // Extra bottom space reserves room for the translation, so showing it
  // never pushes the lines below down.
  lineBlock: { position: 'relative', marginBottom: 44 },
  lineRow: { position: 'relative', justifyContent: 'center', paddingHorizontal: 36 },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  lineSpeaking: { backgroundColor: colors.surface },
  // Positioned in the gap below the line, so it doesn't shift other lines.
  lineHe: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    color: colors.primarySoft,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 4,
  },

  lineTranslateBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  wordWrap: { position: 'relative', alignItems: 'center', marginHorizontal: 4 },
  wordWrapActive: { zIndex: 20 },
  // Keep the same fontWeight in every state so tapping never resizes/moves text.
  word: { color: colors.text, fontSize: 27, lineHeight: 44, fontWeight: '600' },
  wordSelected: {
    color: colors.primarySoft,
    textDecorationLine: 'underline',
  },
  wordSpeaking: {
    color: colors.primarySoft,
  },

  // Bubble centered above the word using the symmetric left/right trick.
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
    marginTop: -1,
  },
});
