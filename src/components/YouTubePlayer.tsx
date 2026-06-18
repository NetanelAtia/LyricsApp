import { Text, View } from 'react-native';
import { colors, spacing } from '../theme';

// Native placeholder. On a real device we'll later use
// react-native-youtube-iframe. For now the YouTube player works in the
// web preview (YouTubePlayer.web.tsx).
export default function YouTubePlayer(_props: { videoId: string; onReady?: (p: any) => void }) {
  return (
    <View style={{ padding: spacing.lg }}>
      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
        נגן היוטיוב זמין כרגע בתצוגת הדפדפן (web).
      </Text>
    </View>
  );
}
