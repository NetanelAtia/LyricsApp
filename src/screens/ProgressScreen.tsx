import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import {
  getProgress,
  getLevel,
  xpIntoLevel,
  accuracy,
  DAILY_GOAL,
  XP_PER_LEVEL,
} from '../progress';
import { getVocab } from '../vocab';
import { colors, fonts, radius, spacing } from '../theme';

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function ProgressScreen({ navigation }: any) {
  const p = getProgress();
  const level = getLevel(p.xp);
  const inLevel = xpIntoLevel(p.xp);
  const totalWords = getVocab().length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>📊 ההתקדמות שלי</Text>

        {/* Level + XP */}
        <View style={styles.card}>
          <View style={styles.levelRow}>
            <Text style={styles.levelText}>רמה {level}</Text>
            <Text style={styles.xpText}>{p.xp} XP</Text>
          </View>
          <Bar value={inLevel / XP_PER_LEVEL} color={colors.primary} />
          <Text style={styles.subtle}>עוד {XP_PER_LEVEL - inLevel} XP לרמה הבאה</Text>
        </View>

        {/* Daily streak + goal */}
        <View style={styles.card}>
          <View style={styles.levelRow}>
            <Text style={styles.streakText}>🔥 {p.streak} ימים רצף</Text>
            <Text style={styles.subtle}>מטרה יומית</Text>
          </View>
          <Bar value={p.todayXp / DAILY_GOAL} color={colors.warning} />
          <Text style={styles.subtle}>
            {p.todayXp} / {DAILY_GOAL} XP היום {p.todayXp >= DAILY_GOAL ? '✓ הושלם!' : ''}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat value={p.mastered.length} label="מילים נלמדו" />
          <Stat value={totalWords} label="מילים שמורות" />
          <Stat value={`${accuracy(p)}%`} label="אחוז הצלחה" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primarySoft, fontSize: 20, fontFamily: fonts.bold },
  body: { padding: spacing.lg },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display, marginBottom: spacing.lg },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  levelText: { color: colors.text, fontSize: 20, fontWeight: '800' },
  xpText: { color: colors.primarySoft, fontSize: 16, fontWeight: '700' },
  streakText: { color: colors.text, fontSize: 20, fontWeight: '800' },
  subtle: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },

  barTrack: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceLight, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },
});
