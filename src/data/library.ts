// The songs shown on the home screen. Each has a bundled lyrics file in
// public/lyrics/<videoId>.lrc. Tapping a song opens it straight in karaoke.

export type LibrarySong = {
  videoId: string;
  artist: string;
  track: string;
  emoji: string;
  accent: string;
};

export const library: LibrarySong[] = [
  { videoId: 'RBumgq5yVrA', artist: 'Passenger', track: 'Let Her Go', emoji: '🎸', accent: '#6c5ce7' },
  { videoId: 'Man4Xw8Xypo', artist: 'The Beatles', track: 'Blackbird', emoji: '🐦', accent: '#0984e3' },
  { videoId: 'L3wKzyIN1yk', artist: "Rag'n'Bone Man", track: 'Human', emoji: '✊', accent: '#00b894' },
  { videoId: 'XXYlFuWEuKI', artist: 'The Weeknd', track: 'Save Your Tears', emoji: '🌙', accent: '#e17055' },
  { videoId: 'kPBzTxZQG5Q', artist: '3 Doors Down', track: 'Here Without You', emoji: '🚪', accent: '#e84393' },
];
