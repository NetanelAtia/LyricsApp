// Short synthesized sound effects for correct/wrong game answers — uses the
// Web Audio API directly so no audio files need to be bundled.

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

// A bright, punchy three-note rising "ta-da" for a correct answer — louder
// and shinier than a plain two-note ding.
export function playCorrect() {
  tone(523, 0, 0.12, 0.32, 'triangle'); // C5
  tone(659, 0.08, 0.12, 0.34, 'triangle'); // E5
  tone(880, 0.16, 0.28, 0.36, 'triangle'); // A5
}

// A buzzy, descending "error" honk for a wrong answer — louder and more
// attention-grabbing than a plain low thud.
export function playWrong() {
  tone(300, 0, 0.22, 0.3, 'sawtooth', 120);
  tone(220, 0.16, 0.24, 0.28, 'sawtooth', 90);
}
