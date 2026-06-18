import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, difficultyColor, radius, spacing } from '../theme';
import { songs, Song } from '../data/songs';

// The first screen: a scrollable list of songs to choose from.
export default function SongsListScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Let&apos;s learn 🎵</Text>
        <Text style={styles.title}>Choose a song</Text>

        <TouchableOpacity
          style={styles.ytButton}
          onPress={() => navigation.navigate('YouTube')}
          activeOpacity={0.85}
        >
          <Text style={styles.ytButtonText}>🎬  YouTube Karaoke</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        renderItem={({ item }) => (
          <SongCard song={item} onPress={() => navigation.navigate('Song', { songId: item.id })} />
        )}
      />
    </SafeAreaView>
  );
}

function SongCard({ song, onPress }: { song: Song; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cover, { backgroundColor: song.accent }]}>
        <Text style={styles.coverEmoji}>{song.emoji}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.songTitle}>{song.title}</Text>
        <Text style={styles.songArtist}>{song.artist}</Text>

        <View style={[styles.badge, { backgroundColor: difficultyColor[song.difficulty] + '22' }]}>
          <View style={[styles.dot, { backgroundColor: difficultyColor[song.difficulty] }]} />
          <Text style={[styles.badgeText, { color: difficultyColor[song.difficulty] }]}>
            {song.difficulty}
          </Text>
        </View>
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  greeting: { color: colors.textMuted, fontSize: 15, marginBottom: 4 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  ytButton: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  ytButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },

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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  chevron: { color: colors.textFaint, fontSize: 28, paddingHorizontal: spacing.sm },
});
