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
  { videoId: 'GBSu_ltDu1w', artist: 'The Beatles', track: 'Blackbird', emoji: '🐦', accent: '#0984e3' },
  { videoId: 'L3wKzyIN1yk', artist: "Rag'n'Bone Man", track: 'Human', emoji: '✊', accent: '#00b894' },
  { videoId: 'XXYlFuWEuKI', artist: 'The Weeknd', track: 'Save Your Tears', emoji: '🌙', accent: '#e17055' },
  { videoId: 'kPBzTxZQG5Q', artist: '3 Doors Down', track: 'Here Without You', emoji: '🚪', accent: '#e84393' },
  { videoId: 'RgKAFK5djSk', artist: 'Wiz Khalifa ft. Charlie Puth', track: 'See You Again', emoji: '🚗', accent: '#00cec9' },
  { videoId: 'hLQl3WQQoQ0', artist: 'Adele', track: 'Someone Like You', emoji: '💔', accent: '#d63031' },
  { videoId: 'EkHTsc9PU2A', artist: 'Jason Mraz', track: "I'm Yours", emoji: '☀️', accent: '#fdcb6e' },
  { videoId: 'JGwWNGJdvx8', artist: 'Ed Sheeran', track: 'Shape of You', emoji: '💃', accent: '#fd79a8' },
  { videoId: 'fLexgOxsZu0', artist: 'Bruno Mars', track: 'The Lazy Song', emoji: '😎', accent: '#a29bfe' },
  { videoId: '2Vv-BfVoq4g', artist: 'Ed Sheeran', track: 'Perfect', emoji: '💍', accent: '#fab1a0' },
  { videoId: '450p7goxZqg', artist: 'John Legend', track: 'All of Me', emoji: '🎹', accent: '#74b9ff' },
  { videoId: '0yW7w8F2TVA', artist: 'James Arthur', track: "Say You Won't Let Go", emoji: '💑', accent: '#55efc4' },
  { videoId: 'LHCob76kigA', artist: 'Lukas Graham', track: '7 Years', emoji: '⏳', accent: '#ffeaa7' },
  { videoId: 'LjhCEhWiKXk', artist: 'Bruno Mars', track: 'Just the Way You Are', emoji: '🌹', accent: '#ff7675' },
  { videoId: 'BxuY9FET9Y4', artist: 'Charlie Puth', track: 'One Call Away', emoji: '📞', accent: '#81ecec' },
  { videoId: 'nfs8NYg7yQM', artist: 'Charlie Puth', track: 'Attention', emoji: '🔥', accent: '#e84393' },
  { videoId: 'SlPhMPnQ58k', artist: 'Maroon 5', track: 'Memories', emoji: '🥂', accent: '#a29bfe' },
  { videoId: 'hT_nvWreIhg', artist: 'OneRepublic', track: 'Counting Stars', emoji: '⭐', accent: '#fdcb6e' },
  { videoId: 'kXYiU_JCYtU', artist: 'Linkin Park', track: 'Numb', emoji: '🎸', accent: '#636e72' },
];
