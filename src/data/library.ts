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
  'LjhCEhWiKXk': -15.7, // Bruno Mars – Just the Way You Are
  'fLexgOxsZu0': -3.0, // Bruno Mars – The Lazy Song
  'Xg72z08aTXY': -0.5, // Måneskin – Beggin'
  'C7dPqrmDWxs': -0.3, // Pharrell Williams – Happy
  'WDaNJW_jEBo': -0.5, // Busta Rhymes ft. Mariah Carey – I Know What You Want
};

// videoIds whose lyrics + word-timing were pulled straight from that exact
// YouTube video's own official captions (so they're guaranteed to match the
// edit/version embedded in the app). Everything else came from a separate
// lyrics database (LRCLIB) that was matched by song name/duration.
export const youtubeSourcedLyrics = new Set<string>([
  'UXWFqxKU2qA', // Snoop Dogg – Vato
  'CaCSuzR4DwM', // Louis Armstrong – What A Wonderful World
  'kXYiU_JCYtU', // Linkin Park – Numb
  'YQHsXMglC9A', // Adele – Hello
  'hLQl3WQQoQ0', // Adele – Someone Like You
  'EkHTsc9PU2A', // Jason Mraz – I'm Yours
  'kPBzTxZQG5Q', // 3 Doors Down – Here Without You
  'WDaNJW_jEBo', // Busta Rhymes ft. Mariah Carey – I Know What You Want
  'pfxyk1glEq4', // Chris Brown – Under The Influence
  '2Vv-BfVoq4g', // Ed Sheeran – Perfect
  'JGwWNGJdvx8', // Ed Sheeran – Shape of You
  'H5v3kku4y6Q', // Harry Styles – As It Was
  '0yW7w8F2TVA', // James Arthur – Say You Won't Let Go
  '450p7goxZqg', // John Legend – All of Me
  'Zi_XLOBDo_Y', // Michael Jackson – Billie Jean
  'LHCob76kigA', // Lukas Graham – 7 Years
  'r7qovpFAGrQ', // Lil Nas X – Old Town Road
  'oyEuk8j8imI', // Justin Bieber – Love Yourself
  '3AyMjyHu1bA', // Justin Bieber – Intentions
  'Lt3IOdDE5iA', // John Lennon – Beautiful Boy
  'RBumgq5yVrA', // Passenger – Let Her Go
  'hT_nvWreIhg', // OneRepublic – Counting Stars
  'L3wKzyIN1yk', // Rag'n'Bone Man – Human
  'YaEG2aWJnZ8', // Sia – Unstoppable
  'fHI8X4OXluQ', // The Weeknd – Blinding Lights
  'XXYlFuWEuKI', // The Weeknd – Save Your Tears
  'RgKAFK5djSk', // Wiz Khalifa ft. Charlie Puth – See You Again
  'Lt3IOdDE5iA', // John Lennon – Beautiful Boy
  '8gyLR4NfMiI', // Chris Brown ft. Lil Wayne, Busta Rhymes – Look At Me Now
  'QVXE1EzMrfw', // Ja Rule ft. R. Kelly, Ashanti – Wonderful
  '34Na4j8AVgA', // The Weeknd ft. Daft Punk – Starboy
  'WpYeekQkAdc', // Black Eyed Peas – Where Is The Love?
  'UYwF-jdcVjY', // Post Malone – Better Now
  'wXhTHyIgQ_U', // Post Malone – Circles
  'tt2k8PGm-TI', // ZAYN ft. Sia – Dusk Till Dawn
  '8WYHDfJDPDc', // Nelly ft. Kelly Rowland – Dilemma
  'VcP96KbFIIU', // Ja Rule ft. Ashanti – Mesmerize
  'GxBSyx85Kp8', // Usher ft. Lil Jon, Ludacris – Yeah!
]);

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
  { videoId: 'pfxyk1glEq4', artist: 'Chris Brown', track: 'Under The Influence', emoji: '🌀', accent: '#6c5ce7' },
  { videoId: '8gyLR4NfMiI', artist: 'Chris Brown ft. Lil Wayne, Busta Rhymes', track: 'Look At Me Now', emoji: '🔥', accent: '#ff7675' },
  { videoId: 'QVXE1EzMrfw', artist: 'Ja Rule ft. R. Kelly, Ashanti', track: 'Wonderful', emoji: '✨', accent: '#fdcb6e' },
  { videoId: '34Na4j8AVgA', artist: 'The Weeknd ft. Daft Punk', track: 'Starboy', emoji: '🌟', accent: '#2d3436' },
  { videoId: 'WpYeekQkAdc', artist: 'Black Eyed Peas', track: 'Where Is The Love?', emoji: '🌐', accent: '#00b894' },
  { videoId: 'UYwF-jdcVjY', artist: 'Post Malone', track: 'Better Now', emoji: '💔', accent: '#74b9ff' },
  { videoId: 'wXhTHyIgQ_U', artist: 'Post Malone', track: 'Circles', emoji: '🔄', accent: '#a29bfe' },
  { videoId: 'tt2k8PGm-TI', artist: 'ZAYN ft. Sia', track: 'Dusk Till Dawn', emoji: '🌆', accent: '#6c5ce7' },
  { videoId: '8WYHDfJDPDc', artist: 'Nelly ft. Kelly Rowland', track: 'Dilemma', emoji: '❓', accent: '#fdcb6e' },
  { videoId: 'VcP96KbFIIU', artist: 'Ja Rule ft. Ashanti', track: 'Mesmerize', emoji: '💫', accent: '#e84393' },
  { videoId: 'GxBSyx85Kp8', artist: 'Usher ft. Lil Jon, Ludacris', track: 'Yeah!', emoji: '🎉', accent: '#00cec9' },
  { videoId: 'Lt3IOdDE5iA', artist: 'John Lennon', track: 'Beautiful Boy', emoji: '👶', accent: '#fdcb6e' },
];
