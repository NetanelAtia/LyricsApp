import { useState, useEffect } from 'react';
import { FlatList, Image, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '../theme';
import { library, LibrarySong, youtubeSourcedLyrics, readySongs } from '../data/library';
import { getProgress, getLevel, xpIntoLevel } from '../progress';
import { getVocab } from '../vocab';

// Home screen: the list of songs. Tapping one opens it straight in karaoke.
const PAGE_SIZE = 20;

export default function SongsListScreen({ navigation }: any) {
  const [prog, setProg] = useState(getProgress());
  const [vocabCount, setVocabCount] = useState(getVocab().length);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  // Refresh stats whenever we return to this screen.
  useEffect(
    () => navigation.addListener('focus', () => { setProg(getProgress()); setVocabCount(getVocab().length); }),
    [navigation]
  );

  const q = query.trim().toLowerCase();
  // Sort by artist A→Z (ignoring a leading "The", case-insensitive), then by song.
  const sortKey = (s: string) => s.replace(/^the\s+/i, '').toLowerCase().trim();
  const allSongs = library
    .filter((s) => !q || s.track.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
    .slice()
    .sort(
      (a, b) =>
        sortKey(a.artist).localeCompare(sortKey(b.artist)) ||
        sortKey(a.track).localeCompare(sortKey(b.track))
    );

  const pageCount = Math.max(1, Math.ceil(allSongs.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const songs = allSongs.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  // Reset to page 1 whenever the search narrows/changes the results.
  useEffect(() => setPage(0), [q]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>השירים שלי</Text>
        <Text style={styles.greeting}>לימוד אנגלית דרך שירים 🎵</Text>

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
          placeholder="🔍 ...חיפוש שיר"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={songs}
        keyExtractor={(s) => s.videoId}
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
        renderItem={({ item, index }) => (
          <SongCard
            song={item}
            number={currentPage * PAGE_SIZE + index + 1}
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
          <>
            {pageCount > 1 && (
              <View style={styles.pager}>
                <TouchableOpacity
                  style={[styles.pagerBtn, currentPage === 0 && styles.pagerBtnDisabled]}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  <Text style={styles.pagerBtnText}>‹ הקודם</Text>
                </TouchableOpacity>
                <Text style={styles.pagerLabel}>עמוד {currentPage + 1} מתוך {pageCount}</Text>
                <TouchableOpacity
                  style={[styles.pagerBtn, currentPage === pageCount - 1 && styles.pagerBtnDisabled]}
                  onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={currentPage === pageCount - 1}
                >
                  <Text style={styles.pagerBtnText}>הבא ›</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('YouTube', {})}
              activeOpacity={0.85}
            >
              <Text style={styles.addBtnText}>➕  שיר אחר מיוטיוב</Text>
            </TouchableOpacity>
            <Text style={styles.countLabel}>
              {allSongs.length} {allSongs.length === 1 ? 'שיר' : 'שירים'} בספרייה
            </Text>
            <Text style={styles.legendLabel}>סימן 🔤 אדום ליד הנגן = מילים ותזמון מהכתוביות הרשמיות של סרטון היוטיוב</Text>
          </>
        }
      />
    </SafeAreaView>
  );
}

function SongCard({ song, number, onPress }: { song: LibrarySong; number: number; onPress: () => void }) {
  const handleShare = () => {
    const appUrl = `https://netanelatia.github.io/LyricsApp/?song=${song.videoId}`;
    Share.share({
      message: `🎵 ${song.track} – ${song.artist}\n${appUrl}`,
      url: appUrl,
    });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.cardNumber}>{number}</Text>
      <Image
        source={{ uri: `https://img.youtube.com/vi/${song.videoId}/mqdefault.jpg` }}
        style={styles.cover}
      />
      <View style={styles.cardBody}>
        <Text style={styles.songTitle}>{song.track}</Text>
        <Text style={styles.songArtist}>{song.artist}</Text>
      </View>
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare} hitSlop={8}>
        <MaterialIcons name="share" size={18} color={colors.textFaint} />
      </TouchableOpacity>
      <View style={styles.playCol}>
        {youtubeSourcedLyrics.has(song.videoId) && (
          <MaterialIcons name="translate" size={14} color={colors.danger} style={styles.sourceBadge} />
        )}
        <Text style={styles.play}>▶</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  greeting: { color: colors.textMuted, fontSize: 15, marginBottom: 4, textAlign: 'center' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },

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
  cardNumber: { color: colors.textFaint, fontSize: 13, fontWeight: '700', width: 22, textAlign: 'center' },
  cover: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLight,
  },
  cardBody: { flex: 1, marginLeft: spacing.md },
  songTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  songArtist: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  playCol: { alignItems: 'center', paddingHorizontal: spacing.md },
  sourceBadge: { marginBottom: 2 },
  readyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  shareBtn: { padding: 6, marginHorizontal: 4 },
  play: { color: colors.primarySoft, fontSize: 20 },

  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pagerBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pagerLabel: { color: colors.textMuted, fontSize: 13 },

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
  countLabel: { color: colors.textFaint, fontSize: 13, textAlign: 'center', marginTop: spacing.md },
  legendLabel: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 4 },
});
