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

function tone(freq: number, startOffset: number, duration: number, peak: number) {
  const ac = getCtx();
  if (!ac) return;
  const start = ac.currentTime + startOffset;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

// A short, cheerful two-note "ding" for a correct answer.
export function playCorrect() {
  tone(660, 0, 0.16, 0.25);
  tone(880, 0.09, 0.2, 0.25);
}

// A short, low "thud" for a wrong answer.
export function playWrong() {
  tone(180, 0, 0.25, 0.2);
}
