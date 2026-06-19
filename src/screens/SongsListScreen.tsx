import { useState, useEffect } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../theme';
import { library, LibrarySong } from '../data/library';
import { getProgress, getLevel, xpIntoLevel } from '../progress';
import { getVocab } from '../vocab';

// Home screen: the list of songs. Tapping one opens it straight in karaoke.
export default function SongsListScreen({ navigation }: any) {
  const [prog, setProg] = useState(getProgress());
  const [vocabCount, setVocabCount] = useState(getVocab().length);
  const [query, setQuery] = useState('');
  // Refresh stats whenever we return to this screen.
  useEffect(
    () => navigation.addListener('focus', () => { setProg(getProgress()); setVocabCount(getVocab().length); }),
    [navigation]
  );

  const q = query.trim().toLowerCase();
  // Sort by artist A→Z (ignoring a leading "The", case-insensitive), then by song.
  const sortKey = (s: string) => s.replace(/^the\s+/i, '').toLowerCase().trim();
  const songs = library
    .filter((s) => !q || s.track.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
    .slice()
    .sort(
      (a, b) =>
        sortKey(a.artist).localeCompare(sortKey(b.artist)) ||
        sortKey(a.track).localeCompare(sortKey(b.track))
    );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Learn English with songs 🎵</Text>
        <Text style={styles.title}>Your Songs</Text>

        {/* Progress banner */}
        <TouchableOpacity
          style={styles.statsBanner}
          onPress={() => navigation.navigate('Progress')}
          activeOpacity={0.85}
        >
          <Text style={styles.statsStreak}>🔥 {prog.streak}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.statsTopRow}>
              <Text style={styles.statsLevel}>רמה {getLevel(prog.xp)}</Text>
              <Text style={styles.statsXp}>{prog.xp} XP</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${xpIntoLevel(prog.xp)}%` }]} />
            </View>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>

        {/* Vocab banner — equally prominent, leads to the saved word list + games. */}
        <TouchableOpacity
          style={styles.vocabBanner}
          onPress={() => navigation.navigate('Vocab')}
          activeOpacity={0.85}
        >
          <Text style={styles.vocabBannerIcon}>📚</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.vocabBannerTitle}>אוצר מילים</Text>
            <Text style={styles.vocabBannerSub}>{vocabCount} מילים שמורות</Text>
          </View>
          <Text style={styles.vocabBannerChev}>›</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.search}
          placeholder="🔍 חיפוש שיר..."
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={songs}
        keyExtractor={(s) => s.videoId}
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        renderItem={({ item }) => (
          <SongCard
            song={item}
            onPress={() =>
              navigation.navigate('YouTube', {
                videoId: item.videoId,
                artist: item.artist,
                track: item.track,
              })
            }
          />
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('YouTube', {})}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>➕  שיר אחר מיוטיוב</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

function SongCard({ song, onPress }: { song: LibrarySong; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cover, { backgroundColor: song.accent }]}>
        <Text style={styles.coverEmoji}>{song.emoji}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.songTitle}>{song.track}</Text>
        <Text style={styles.songArtist}>{song.artist}</Text>
      </View>
      <Text style={styles.play}>▶</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  greeting: { color: colors.textMuted, fontSize: 15, marginBottom: 4 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },

  vocabBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  vocabBannerIcon: { fontSize: 26 },
  vocabBannerTitle: { color: '#fff', fontSize: 19, fontFamily: fonts.display },
  vocabBannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  vocabBannerChev: { color: '#fff', fontSize: 22 },

  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  statsStreak: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statsTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statsLevel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  statsXp: { color: colors.primarySoft, fontSize: 13, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceLight, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  chev: { color: colors.textFaint, fontSize: 22 },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    marginTop: spacing.md,
    textAlign: 'right',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: { fontSize: 30 },
  cardBody: { flex: 1, marginLeft: spacing.md },
  songTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  songArtist: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  play: { color: colors.primarySoft, fontSize: 20, paddingHorizontal: spacing.md },

  addBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  addBtnText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
