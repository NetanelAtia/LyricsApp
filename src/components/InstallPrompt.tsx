import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

const STORAGE_KEY = 'lyricsapp:install-prompt-dismissed';

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

function isIOS(): boolean {
  try {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {}
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios] = useState(isIOS);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isStandalone()) return;
    if (isDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setHasNativePrompt(true);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Fallback: show manual instructions after 2s if no native prompt arrived
    const timer = setTimeout(() => {
      if (!deferredPrompt.current) setVisible(true);
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (outcome === 'accepted') {
        dismiss();
        setVisible(false);
      }
    }
  };

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  const handleClose = () => {
    setVisible(false);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📱</Text>
          <Text style={styles.title}>התקן את LyricsApp</Text>
          <Text style={styles.subtitle}>
            למד אנגלית דרך שירים — בחינם, בלי חנות אפליקציות
          </Text>

          {ios || !hasNativePrompt ? (
            <View style={styles.iosSteps}>
              {ios ? (
                <>
                  <Text style={styles.iosStep}><Text style={styles.iosStepNum}>1. </Text>לחץ על <Text style={styles.iosBold}>שלוש הנקודות</Text> ⋯ בדפדפן</Text>
                  <Text style={styles.iosStep}><Text style={styles.iosStepNum}>2. </Text>לחץ על <Text style={styles.iosBold}>שיתוף</Text></Text>
                  <Text style={styles.iosStep}><Text style={styles.iosStepNum}>3. </Text>לחץ על <Text style={styles.iosBold}>הצגת עוד</Text></Text>
                  <Text style={styles.iosStep}><Text style={styles.iosStepNum}>4. </Text>גלול מטה ולחץ על <Text style={styles.iosBold}>הוסף למסך הבית</Text></Text>
                  <Text style={styles.iosStep}><Text style={styles.iosStepNum}>5. </Text>לחץ <Text style={styles.iosBold}>הוספה</Text></Text>
                </>
              ) : (
                <>
                  <Text style={styles.iosStep}><Text style={styles.iosStepNum}>1. </Text>לחץ על <Text style={styles.iosBold}>שלוש הנקודות</Text> ⋮ בדפדפן</Text>
                  <Text style={styles.iosStep}><Text style={styles.iosStepNum}>2. </Text>לחץ על <Text style={styles.iosBold}>הוסף למסך הבית</Text></Text>
                  <Text style={styles.iosStep}><Text style={styles.iosStepNum}>3. </Text>לחץ <Text style={styles.iosBold}>הוסף</Text></Text>
                </>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.installBtn} onPress={handleInstall} activeOpacity={0.85}>
              <Text style={styles.installBtnText}>➕  הוסף למסך הבית</Text>
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            {(ios || !hasNativePrompt) && (
              <TouchableOpacity onPress={handleClose} style={styles.footerBtn}>
                <Text style={styles.footerBtnText}>סגור</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleDismiss} style={styles.footerBtn}>
              <Text style={styles.footerDismiss}>אל תציג לי שוב</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  emoji: { fontSize: 48, marginBottom: spacing.sm },
  title: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  installBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  installBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  iosSteps: {
    width: '100%',
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  iosStep: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'right',
  },
  iosStepNum: { color: colors.primarySoft, fontFamily: fonts.bold },
  iosIcon: { fontSize: 16 },
  iosBold: { fontFamily: fonts.bold, color: colors.text },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  footerBtn: { padding: spacing.sm },
  footerBtnText: { color: colors.textMuted, fontSize: 14 },
  footerDismiss: { color: colors.textFaint, fontSize: 13 },
});
