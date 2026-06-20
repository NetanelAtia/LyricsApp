// The songs shown on the home screen. Each has a bundled lyrics file in
// public/lyrics/<videoId>.lrc. Tapping a song opens it straight in karaoke.

export type LibrarySong = {
  videoId: string;
  artist: string;
  track: string;
  emoji: string;
  accent: string;
};

// Built-in sync corrections (seconds) for songs whose YouTube video timing
// differs from the lyrics file — so everyone gets them aligned by default.
// A user's own calibration (saved locally) overrides these.
export const defaultOffsets: Record<string, number> = {
  '2Vv-BfVoq4g': -18.8, // Ed Sheeran – Perfect
  'EkHTsc9PU2A': -7.0, // Jason Mraz – I'm Yours
  'LjhCEhWiKXk': -15.7, // Bruno Mars – Just the Way You Are
  'fLexgOxsZu0': -3.0, // Bruno Mars – The Lazy Song
  'Xg72z08aTXY': -0.5, // Måneskin – Beggin'
  'Zi_XLOBDo_Y': -0.6, // Michael Jackson – Billie Jean
  'YQHsXMglC9A': -63.4, // Adele – Hello
  'oyEuk8j8imI': -9.9, // Justin Bieber – Love Yourself
  'CaCSuzR4DwM': -1.7, // Louis Armstrong – What A Wonderful World
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
  { videoId: 'Xg72z08aTXY', artist: 'Måneskin', track: "Beggin'", emoji: '🐺', accent: '#d63031' },
  { videoId: 'YQHsXMglC9A', artist: 'Adele', track: 'Hello', emoji: '📞', accent: '#636e72' },
  { videoId: 'eVTXPUF4Oz4', artist: 'Linkin Park', track: 'In The End', emoji: '⏳', accent: '#2d3436' },
  { videoId: 'Zi_XLOBDo_Y', artist: 'Michael Jackson', track: 'Billie Jean', emoji: '🕺', accent: '#2d3436' },
  { videoId: 'CaCSuzR4DwM', artist: 'Louis Armstrong', track: 'What A Wonderful World', emoji: '🌍', accent: '#00b894' },
  { videoId: '3AyMjyHu1bA', artist: 'Justin Bieber', track: 'Intentions', emoji: '💛', accent: '#fdcb6e' },
  { videoId: 'oyEuk8j8imI', artist: 'Justin Bieber', track: 'Love Yourself', emoji: '💔', accent: '#74b9ff' },
  { videoId: 'H5v3kku4y6Q', artist: 'Harry Styles', track: 'As It Was', emoji: '🌪️', accent: '#a29bfe' },
  { videoId: 'YaEG2aWJnZ8', artist: 'Sia', track: 'Unstoppable', emoji: '🦋', accent: '#fd79a8' },
  { videoId: 'fHI8X4OXluQ', artist: 'The Weeknd', track: 'Blinding Lights', emoji: '🌃', accent: '#e17055' },
  { videoId: 'r7qovpFAGrQ', artist: 'Lil Nas X', track: 'Old Town Road', emoji: '🤠', accent: '#fdcb6e' },
  { videoId: 'xFYQQPAOz7Y', artist: 'Eminem', track: 'Lose Yourself', emoji: '🎤', accent: '#636e72' },
  { videoId: 'C7dPqrmDWxs', artist: 'Pharrell Williams', track: 'Happy', emoji: '😄', accent: '#fdcb6e' },
  { videoId: 'UXWFqxKU2qA', artist: 'Snoop Dogg', track: 'Vato', emoji: '😎', accent: '#00b894' },
  { videoId: 'WDaNJW_jEBo', artist: 'Busta Rhymes ft. Mariah Carey', track: 'I Know What You Want', emoji: '💋', accent: '#e84393' },
];
