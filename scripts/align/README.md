# Word-level alignment (local, dev-only)

Produces exact word-by-word timestamps for a song by force-aligning its
already-bundled lyrics text against an audio file **you provide yourself**.
This only runs on your machine, manually, per song — it's not part of the
app's build or runtime.

## One-time setup (already done on this machine)

- ffmpeg installed via winget
- `scripts/align/venv` — a Python virtual environment with `whisperx` + `torch` (CPU)

If setting this up again elsewhere:

```
winget install --id Gyan.FFmpeg -e
py -3.11 -m venv scripts/align/venv
scripts/align/venv/Scripts/python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
scripts/align/venv/Scripts/python.exe -m pip install whisperx
```

## Using it for a song

1. Download the song's audio yourself (you're responsible for the source/rights).
2. Run:

```
scripts\align\venv\Scripts\python.exe scripts\align\align.py --audio "C:\path\to\song.mp3" --video-id <videoId>
```

`<videoId>` must match an existing `public/lyrics/<videoId>.lrc` file — the
script aligns that exact bundled text against your audio (it does not
re-transcribe, so the output always matches our lyrics word-for-word).

3. This writes `public/wordtiming/<videoId>.json`. The app automatically
   uses it for that song's word highlight instead of the estimate, as long
   as the file exists and its word count matches each line.

The first run downloads the alignment model (a few hundred MB); it's cached
under your user profile afterwards, so later runs are much faster.
