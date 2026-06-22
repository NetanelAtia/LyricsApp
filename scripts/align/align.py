"""
Forced word-level alignment for one song.

Takes an audio file you've already downloaded yourself, plus the song's
existing bundled line-level LRC (public/lyrics/<videoId>.lrc), and produces
exact word-by-word timestamps by aligning the KNOWN lyrics text against the
audio (not re-transcribing — that could guess different words). Output goes
to public/wordtiming/<videoId>.json, keyed by the same LRC tag used
elsewhere in the project, each holding a list of {word, start, end}.

Usage (from the project root, with the venv active):
    scripts/align/venv/Scripts/python.exe scripts/align/align.py \
        --audio "C:\\path\\to\\song.mp3" --video-id Xg72z08aTXY

Requires ffmpeg on PATH and an internet connection the first time (to
download the alignment model — a few hundred MB, cached afterwards).
"""
import argparse
import json
import os
import re
import sys

import whisperx

LRC_LINE_RE = re.compile(r"^\[(\d{2}):(\d{2}\.\d{2})\](.*)$")


def parse_lrc(path):
    lines = []
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            m = LRC_LINE_RE.match(raw.strip())
            if not m:
                continue
            mm, ss, text = m.groups()
            start = int(mm) * 60 + float(ss)
            tag = f"{mm}:{ss}"
            # "¦" marks a forced line break preserved from a multi-line
            # source caption (rendered as a real newline in the app) — the
            # aligner just needs the words in order, so flatten it to a space.
            lines.append({"tag": tag, "start": start, "text": text.strip().replace("¦", " ")})
    return lines


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True, help="Path to the audio file you downloaded")
    parser.add_argument("--video-id", required=True, help="The song's YouTube video id (matches the .lrc filename)")
    parser.add_argument("--language", default="en")
    parser.add_argument(
        "--interpolate",
        default="nearest",
        choices=["nearest", "linear", "ignore"],
        help="How to fill in timing for words the model couldn't confidently place "
        "(common on a held/sustained note) — try 'linear' if 'nearest' looks off for a song.",
    )
    args = parser.parse_args()

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    lrc_path = os.path.join(project_root, "public", "lyrics", f"{args.video_id}.lrc")
    if not os.path.exists(lrc_path):
        sys.exit(f"No bundled lyrics found at {lrc_path}")

    lines = parse_lrc(lrc_path)
    sung_lines = [l for l in lines if l["text"]]
    if not sung_lines:
        sys.exit("No non-instrumental lines found in that .lrc file.")

    # Each line's start/end window (end = next line's start, or +6s for the
    # last line). The alignment model only needs an approximate window — it
    # finds the exact word boundaries itself.
    windows = []
    for i, l in enumerate(sung_lines):
        end = sung_lines[i + 1]["start"] if i + 1 < len(sung_lines) else l["start"] + 6.0
        windows.append((l["start"], end))

    print(f"Loading audio: {args.audio}")
    audio = whisperx.load_audio(args.audio)

    print("Loading alignment model (downloads once, then cached)...")
    align_model, metadata = whisperx.load_align_model(language_code=args.language, device="cpu")

    # Align ONE line at a time, not the whole song in a single call.
    # whisperx internally groups its output by (start, end) timestamp —
    # if two different lines happen to land on the same aligned timestamp
    # (common with short, repeated phrases), it silently MERGES them into
    # one entry, which shifts every following line's pairing by one and
    # quietly corrupts the rest of the song. Aligning line-by-line makes
    # that impossible, since there's never more than one segment to merge.
    print(f"Aligning {len(sung_lines)} lines against the audio, one at a time (interpolate={args.interpolate})...")
    out = {}
    for i, (line, (start, end)) in enumerate(zip(sung_lines, windows)):
        result = whisperx.align(
            [{"start": start, "end": end, "text": line["text"]}],
            align_model, metadata, audio, "cpu",
            interpolate_method=args.interpolate, return_char_alignments=False,
        )
        words = []
        for seg in result["segments"]:
            for w in seg.get("words", []):
                if "start" not in w or "end" not in w:
                    continue  # whisperx leaves timing off words it couldn't align at all
                entry = {"word": w["word"], "start": round(w["start"], 3), "end": round(w["end"], 3)}
                if "score" in w:
                    entry["score"] = round(w["score"], 3)
                words.append(entry)
        out[line["tag"]] = words
        if (i + 1) % 10 == 0 or i + 1 == len(sung_lines):
            print(f"  {i + 1}/{len(sung_lines)} lines aligned")

    out_dir = os.path.join(project_root, "public", "wordtiming")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{args.video_id}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    total_words = sum(len(v) for v in out.values())
    print(f"Wrote {out_path} ({len(out)} lines, {total_words} words timed)")


if __name__ == "__main__":
    main()
