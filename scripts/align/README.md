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

## If one word looks off (held/sustained notes)

The alignment model is trained on ordinary read speech, not singing — its
weak spot is a word stretched over a long held/sustained note, where it
sometimes can't confidently place the boundary and falls back to guessing
from the nearest confidently-placed neighbors. Try re-running with:

```
... --interpolate linear
```

instead of the default `nearest`. It won't fix every case (this is close to
the practical ceiling for a speech-trained model on singing), but it's
worth trying per-song if a specific held word bothers you.
