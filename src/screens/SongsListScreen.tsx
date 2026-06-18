import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { library, LibrarySong } from '../data/library';

// Home screen: the list of songs. Tapping one opens it straight in karaoke.
export default function SongsListScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Learn English with songs 🎵</Text>
        <Text style={styles.title}>Your Songs</Text>
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
  greeting: { color: colors.textMuted, fontSize: 15, marginBottom: 4 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },

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
