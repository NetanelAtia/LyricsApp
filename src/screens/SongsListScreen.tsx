import { useState, useEffect } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { library, LibrarySong } from '../data/library';
import { getProgress, getLevel, xpIntoLevel } from '../progress';

// Home screen: the list of songs. Tapping one opens it straight in karaoke.
export default function SongsListScreen({ navigation }: any) {
  const [prog, setProg] = useState(getProgress());
  // Refresh stats whenever we return to this screen.
  useEffect(() => navigation.addListener('focus', () => setProg(getProgress())), [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Learn English with songs 🎵</Text>
            <Text style={styles.title}>Your Songs</Text>
          </View>
          <TouchableOpacity
            style={styles.vocabBtn}
            onPress={() => navigation.navigate('Vocab')}
            activeOpacity={0.85}
          >
            <Text style={styles.vocabIcon}>📚</Text>
            <Text style={styles.vocabLabel}>מילים</Text>
          </TouchableOpacity>
        </View>

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
      </View>

      <FlatList
        data={library}
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
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  greeting: { color: colors.textMuted, fontSize: 15, marginBottom: 4 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  vocabBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  vocabIcon: { fontSize: 22 },
  vocabLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '600' },

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
