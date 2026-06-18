import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { onXpGain } from '../progress';
import { colors, radius } from '../theme';

// Floating "+N XP" that pops up and fades whenever XP is earned anywhere.
export default function XpPopup() {
  const [amount, setAmount] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return onXpGain((xp) => {
      setAmount(xp);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 1100, useNativeDriver: true }).start();
    });
  }, [anim]);

  if (amount === 0) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [10, -60] });
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>+{amount} XP</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
    zIndex: 1000,
  },
  text: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
