import { useEffect, useRef } from 'react';

// Embeds the official YouTube player on web using YouTube's IFrame API.
// This is the legal way to play YouTube songs — the audio/video streams
// from YouTube itself. We can read the current playback time to sync lyrics.

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// Load the YouTube IFrame API script once, shared across the app.
let apiPromise: Promise<any> | null = null;
function loadYouTubeAPI(): Promise<any> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
  });
  return apiPromise;
}

type Props = {
  videoId: string;
  onReady?: (player: any) => void;
};

export default function YouTubePlayer({ videoId, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    loadYouTubeAPI().then((YT) => {
      if (!mounted || !containerRef.current) return;
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '220',
        playerVars: { playsinline: 1, rel: 0 },
        events: { onReady: () => onReady?.(playerRef.current) },
      });
    });
    return () => {
      mounted = false;
      try {
        playerRef.current?.destroy?.();
      } catch {}
    };
  }, [videoId]);

  return (
    <div style={{ width: '100%', borderRadius: 16, overflow: 'hidden' }}>
      <div ref={containerRef} />
    </div>
  );
}
