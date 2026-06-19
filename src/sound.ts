// Short synthesized sound effects + haptic feedback for correct/wrong game
// answers — uses the Web Audio API directly so no audio files need to be
// bundled.

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    const ac = ctx!;
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  startOffset: number,
  duration: number,
  peak: number,
  type: OscillatorType = 'sine',
  endFreq?: number
) {
  const ac = getCtx();
  if (!ac) return;
  const start = ac.currentTime + startOffset;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (endFreq != null) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

// A classic harsh "game show error" buzzer: a low square-wave tone
// amplitude-modulated by a fast LFO, which is what actually gives a buzzer
// its rattling texture (a plain tone just sounds like a horn).
function buzzer() {
  const ac = getCtx();
  if (!ac) return;
  const start = ac.currentTime;
  const duration = 0.5;

  const carrier = ac.createOscillator();
  carrier.type = 'square';
  carrier.frequency.setValueAtTime(150, start);
  carrier.frequency.exponentialRampToValueAtTime(90, start + duration);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.35, start + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  // Tremolo: a fast LFO modulating the gain to create the buzzing texture.
  const lfo = ac.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 45;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.5;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  carrier.connect(gain);
  gain.connect(ac.destination);
  carrier.start(start);
  lfo.start(start);
  carrier.stop(start + duration + 0.02);
  lfo.stop(start + duration + 0.02);
}

// Haptic buzz on native; falls back to the Vibration API on web (only
// Android Chrome actually vibrates — iOS Safari silently ignores it).
function haptic(kind: 'success' | 'error') {
  if (Platform.OS === 'web') {
    try {
      (navigator as any).vibrate?.(kind === 'success' ? 40 : [0, 70, 50, 70]);
    } catch {}
    return;
  }
  try {
    Haptics.notificationAsync(
      kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
  } catch {}
}

// A bright, punchy three-note rising "ta-da" for a correct answer — louder
// and shinier than a plain two-note ding.
export function playCorrect() {
  tone(523, 0, 0.12, 0.32, 'triangle'); // C5
  tone(659, 0.08, 0.12, 0.34, 'triangle'); // E5
  tone(880, 0.16, 0.28, 0.36, 'triangle'); // A5
  haptic('success');
}

// A harsh game-show-style error buzzer for a wrong answer.
export function playWrong() {
  buzzer();
  haptic('error');
}
