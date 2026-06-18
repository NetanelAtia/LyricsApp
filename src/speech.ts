import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

// Speech helper: reads a full line smoothly, and reports which word is
// being spoken right now (so the screen can highlight it in sync).

type SpeakOptions = {
  onWord?: (wordIndex: number) => void;
  onDone?: () => void;
  onStopped?: () => void;
};

const hasWebSpeech =
  Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window;

// Pending highlight timers, so we can cancel them when speech stops.
let timers: ReturnType<typeof setTimeout>[] = [];
function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

// Build a function that maps a character position in the line to a word index.
// Used to turn the browser's "now speaking character N" into "now on word K".
function makeCharToWord(text: string) {
  const starts: number[] = [];
  let pos = 0;
  for (const w of text.split(' ')) {
    starts.push(pos);
    pos += w.length + 1; // +1 for the space
  }
  return (charIndex: number) => {
    let idx = 0;
    for (let i = 0; i < starts.length; i++) {
      if (starts[i] <= charIndex) idx = i;
      else break;
    }
    return idx;
  };
}

// Estimate how long (ms) each word takes to say — longer words take longer.
// This drives the word highlight smoothly and consistently on every platform.
function wordDurations(words: string[]): number[] {
  return words.map((w) => {
    const letters = w.replace(/[^a-zA-Z']/g, '').length;
    return 140 + letters * 60;
  });
}

export function stopSpeaking() {
  clearTimers();
  if (hasWebSpeech) window.speechSynthesis.cancel();
  else Speech.stop();
}

// Read one full line smoothly; calls onWord as each word is spoken.
// Strategy: a timer always steps through the words (guaranteed movement),
// and — when the browser supports it — the precise onboundary event nudges
// the highlight to stay perfectly in sync. Best of both.
export function speakLine(text: string, opts: SpeakOptions = {}) {
  clearTimers();

  const charToWord = makeCharToWord(text);
  const words = text.split(' ');

  // Only ever move forward, so the timer and the boundary event don't fight.
  let current = -1;
  const advanceTo = (i: number) => {
    if (i > current) {
      current = i;
      opts.onWord?.(i);
    }
  };

  // Timer-based stepping (the reliable driver on every platform / voice).
  const durations = wordDurations(words);
  let elapsed = 0;
  words.forEach((_, i) => {
    timers.push(setTimeout(() => advanceTo(i), elapsed));
    elapsed += durations[i];
  });

  if (hasWebSpeech) {
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    // If the browser reports word boundaries, use them for exact sync.
    u.onboundary = (e: any) => {
      if (e.charIndex != null) advanceTo(charToWord(e.charIndex));
    };
    u.onend = () => {
      clearTimers();
      opts.onDone?.();
    };
    window.speechSynthesis.speak(u);
  } else {
    Speech.speak(text, {
      language: 'en-US',
      rate: 0.9,
      onDone: () => {
        clearTimers();
        opts.onDone?.();
      },
      onStopped: () => {
        clearTimers();
        opts.onStopped?.();
      },
    });
  }
}

// Speak a single word (the pronunciation button in the bubble).
export function speakWord(text: string) {
  stopSpeaking();
  if (hasWebSpeech) {
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  } else {
    Speech.speak(text, { language: 'en-US', rate: 0.85 });
  }
}
