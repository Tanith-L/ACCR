"""Build whiteboard lesson videos (MP4 + WebVTT captions) from the scripts in this folder.

Steps for each lesson:
1. Read the narration and scene layouts from scenes_ch1.js / scenes_ch2_6.js.
2. Make one AI-voice clip per spoken line (Microsoft Edge neural TTS via edge-tts), cached by text.
3. Time the scenes from the clip lengths, mix the narration track and write captions.
4. Render the drawing frame by frame in headless Chrome (render.mjs) and encode the MP4.
5. Copy the script, its sources and the voice details into the lesson draft in
   data/psa/assisted-input/all-topics.json, so build_psa_library.py prints them in the lesson Markdown.

Usage (repository root):
    python pipeline/lesson_video/build_videos.py                 # all lessons
    python pipeline/lesson_video/build_videos.py psa-dx-01        # some lessons
    python pipeline/lesson_video/build_videos.py --no-render      # scripts, audio and captions only
    python pipeline/lesson_video/build_videos.py --voice jenny --demo-dir frontend/assets/voice-demo psa-overview-01
        # a sample in another candidate voice, written to <demo-dir>/<voice>/ (lesson data untouched)
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = HERE / ".cache"
DRAFTS = ROOT / "data/psa/assisted-input/all-topics.json"
CHAPTERS = ROOT / "data/psa/chapter"

EDGE_ENGINE = "Microsoft Edge neural text-to-speech, accessed through the open-source edge-tts Python package (v7)"
EDGE_NOTE = "AI-generated voice. Script text was sent to Microsoft's speech service to create the audio."
KOKORO_ENGINE = "Kokoro-82M v1.0 (Apache-2.0 open-weight model), run locally through the kokoro-onnx package"
KOKORO_NOTE = "AI-generated voice. Made on this computer; the script text is not sent to any service."
# Candidate narration voices (all female). "ava" is the one the lesson videos use.
# For edge voices the dict is also the clip cache key, so don't change Ava's without re-voicing.
VOICES = {
    "ava": {"voice": "en-US-AvaMultilingualNeural", "rate": "-4%", "pitch": "+2Hz"},
    "jenny": {"voice": "en-US-JennyNeural", "rate": "-4%", "pitch": "+0Hz"},
    "emma": {"voice": "en-US-EmmaNeural", "rate": "-4%", "pitch": "+0Hz"},
    "heart": {"engine": "kokoro", "voice": "af_heart", "speed": 0.95},
    "bella": {"engine": "kokoro", "voice": "af_bella", "speed": 0.95},
}
VOICE_LABELS = {"ava": "Ava", "jenny": "Jenny", "emma": "Emma", "heart": "Heart", "bella": "Bella"}
KOKORO_FILES = (HERE / ".cache/kokoro/kokoro-v1.0.onnx", HERE / ".cache/kokoro/voices-v1.0.bin")
VOICE = VOICES["ava"]


def voice_record(name: str) -> dict:
    v = VOICES[name]
    if v.get("engine") == "kokoro":
        return {"engine": KOKORO_ENGINE, "voice": f"{v['voice']} ({VOICE_LABELS[name]})", "settings": f"speed {v['speed']}", "note": KOKORO_NOTE}
    return {"engine": EDGE_ENGINE, "voice": f"{v['voice']} ({VOICE_LABELS[name]})",
            "settings": f"rate {v['rate']}, pitch {v['pitch'].replace('Hz', ' Hz')}", "note": EDGE_NOTE}
STYLE = "Whiteboard animation, drawn line by line in time with the narration"
FPS = 24
DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def spoken(text: str) -> str:
    """Spell out abbreviations so the voice reads them letter by letter."""
    for pattern, said in ((r"\bPsA\b", "P-S-A"), (r"\bRF\b", "R-F"), (r"\bDMARDs\b", "D-mards"),
                          (r"\bSI\b", "S-I"), (r"\bMDA\b", "M-D-A"), (r"\bIBD\b", "I-B-D")):
        text = re.sub(pattern, said, text)
    return text


def ffmpeg_exe() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def load_lessons() -> list[dict]:
    script = (
        "const fs=require('fs'),vm=require('vm'),ctx={};vm.createContext(ctx);"
        "for(const f of ['kit.js','scenes_ch1.js','scenes_ch2_6.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);"
        "process.stdout.write(JSON.stringify(vm.runInContext('LESSONS',ctx).map(l=>({id:l.id,title:l.title,"
        "scenes:l.scenes.map(s=>({name:s.name,say:s.say}))}))));"
    )
    out = subprocess.run(["node", "-e", script], cwd=HERE, check=True, capture_output=True, text=True).stdout
    return json.loads(out)


# Kokoro misreads some medical words; these respellings fix them (checked with its phonemizer).
KOKORO_SAY = ((r"\buveitis\b", "youvee-itis"), (r"\bpsoriasis\b", "so-rye-a-sis"), (r"\bsacroiliac\b", "sacro-iliac"))


def voiced(text: str) -> str:
    """The text the voice engine is given."""
    text = spoken(text)
    if VOICE.get("engine") == "kokoro":
        for pattern, said in KOKORO_SAY:
            text = re.sub(pattern, said, text, flags=re.IGNORECASE)
    return text


def clip_path(text: str) -> Path:
    key = hashlib.sha1(json.dumps([VOICE, voiced(text)]).encode()).hexdigest()[:20]
    return CACHE / "voice" / f"{key}.{'wav' if VOICE.get('engine') == 'kokoro' else 'mp3'}"


def make_kokoro_clips(todo: list[str]) -> None:
    import soundfile
    from kokoro_onnx import Kokoro
    if not all(f.exists() for f in KOKORO_FILES):
        sys.exit("Kokoro model files missing; download kokoro-v1.0.onnx and voices-v1.0.bin from "
                 "https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0) into pipeline/lesson_video/.cache/kokoro/")
    model = Kokoro(*map(str, KOKORO_FILES))
    for n, text in enumerate(todo, 1):
        path = clip_path(text)
        path.parent.mkdir(parents=True, exist_ok=True)
        audio, rate = model.create(voiced(text), voice=VOICE["voice"], speed=VOICE["speed"], lang="en-us")
        tmp = path.with_suffix(".tmp.wav")
        soundfile.write(tmp, audio, rate)
        tmp.replace(path)  # never leave a half-written clip in the cache
        print(f"  voice {n}/{len(todo)}")


async def make_clips(lines: list[str]) -> None:
    # An empty file is a clip that was cut off mid-download, so make it again.
    todo = [t for t in dict.fromkeys(lines) if not clip_path(t).exists() or clip_path(t).stat().st_size == 0]
    if VOICE.get("engine") == "kokoro":
        return make_kokoro_clips(todo)
    import edge_tts
    for n, text in enumerate(todo, 1):
        path = clip_path(text)
        path.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(6):
            try:
                # A request can hang with no error, so give each one a time limit and retry.
                await asyncio.wait_for(edge_tts.Communicate(spoken(text), VOICE["voice"], rate=VOICE["rate"], pitch=VOICE["pitch"]).save(str(path)), 60)
                break
            except (Exception, asyncio.TimeoutError) as exc:  # the service sometimes drops a request; retry
                path.unlink(missing_ok=True)
                if attempt == 5:
                    raise
                print(f"  retry ({exc})")
                await asyncio.sleep(3)
        print(f"  voice {n}/{len(todo)}")


def duration(ff: str, path: Path) -> float:
    err = subprocess.run([ff, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def timeline(durs: list[list[float]]) -> tuple[list[dict], float]:
    """Mirror of RENDER.load in render.html: lead-in, gaps between lines, hold at scene end."""
    lead, gap, hold = 0.45, 0.35, 1.1
    scenes, off = [], 0.0
    for scene in durs:
        t, starts = lead, []
        for d in scene:
            starts.append(t)
            t += d + gap
        end = t - gap + hold
        scenes.append({"off": off, "starts": starts, "end": end})
        off += end
    return scenes, off


def vtt_time(t: float) -> str:
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def chapter_folders() -> dict[str, str]:
    parts = yaml.safe_load((ROOT / "data/psa/organization.yaml").read_text(encoding="utf-8"))["parts"]
    return {p["topic_id"]: p["folder"] for p in parts}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="lesson IDs (default: all)")
    ap.add_argument("--no-render", action="store_true", help="skip the MP4 render")
    ap.add_argument("--covers-only", action="store_true", help="only (re)make cover images from the existing MP4s")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--chrome", default=os.environ.get("CHROME_PATH", DEFAULT_CHROME))
    ap.add_argument("--voice", choices=sorted(VOICES), default="ava", help="narration voice (default: ava)")
    ap.add_argument("--demo-dir", type=Path, help="write voice samples to <demo-dir>/<voice>/ and leave the lesson data alone")
    args = ap.parse_args()
    global VOICE
    VOICE = VOICES[args.voice]
    if args.demo_dir:
        args.demo_dir = args.demo_dir.resolve()  # render.mjs runs from this folder
    if args.voice != "ava" and not args.demo_dir:
        sys.exit("The lesson videos use Ava; build other voices as samples with --demo-dir.")
    tag = "" if args.voice == "ava" and not args.demo_dir else f"-{args.voice}"

    lessons = load_lessons()
    if args.ids:
        unknown = set(args.ids) - {l["id"] for l in lessons}
        if unknown:
            sys.exit(f"Unknown lesson IDs: {', '.join(sorted(unknown))}")
        lessons = [l for l in lessons if l["id"] in args.ids]
    drafts_raw = DRAFTS.read_text(encoding="utf-8")
    drafts = json.loads(drafts_raw)
    by_id = {d["id"]: d for d in drafts["lessons"]}
    topic_of = {l["id"]: l["topic_id"] for l in json.loads((CHAPTERS / "psa-content.json").read_text(encoding="utf-8"))["lessons"]}
    folders = chapter_folders()
    for lesson in lessons:
        if lesson["id"] not in by_id:
            sys.exit(f"{lesson['id']} is not in all-topics.json")
        for scene in lesson["scenes"]:
            for line in scene["say"]:
                if "|" not in line or not line.split("|", 1)[1].strip():
                    sys.exit(f"{lesson['id']} / {scene['name']}: line needs 'source|text': {line!r}")

    texts = [line.split("|", 1)[1] for l in lessons for s in l["scenes"] for line in s["say"]]
    print(f"Voice clips for {len(texts)} lines")
    asyncio.run(make_clips(texts))

    ff = ffmpeg_exe()
    jobs = []
    for lesson in lessons:
        lid = lesson["id"]
        outdir = (args.demo_dir / args.voice) if args.demo_dir else CHAPTERS / folders[topic_of[lid]] / "videos"
        outdir.mkdir(parents=True, exist_ok=True)
        clips = [[clip_path(line.split("|", 1)[1]) for line in s["say"]] for s in lesson["scenes"]]
        durs = [[round(duration(ff, c), 3) for c in scene] for scene in clips]
        scenes, total = timeline(durs)

        cues, inputs, filters = ["WEBVTT", ""], [], []
        for S, scene in enumerate(lesson["scenes"]):
            for i, line in enumerate(scene["say"]):
                start = scenes[S]["off"] + scenes[S]["starts"][i]
                cues += [vtt_time(start) + " --> " + vtt_time(start + durs[S][i]), line.split("|", 1)[1], ""]
                k = len(filters)
                inputs += ["-i", str(clips[S][i])]
                ms = int(round(start * 1000))
                filters.append(f"[{k}:a]aresample=24000,adelay=delays={ms}:all=1[a{k}]")
        vtt = outdir / f"{lid}.vtt"
        vtt.write_text("\n".join(cues), encoding="utf-8")
        audio = CACHE / f"tracks{tag}" / f"{lid}.wav"
        audio.parent.mkdir(parents=True, exist_ok=True)
        n = len(filters)
        graph = ";".join(filters) + ";" + "".join(f"[a{k}]" for k in range(n)) + \
            f"amix=inputs={n}:normalize=0:dropout_transition=0,apad=whole_dur={total:.3f}[out]"
        subprocess.run([ff, "-y", "-loglevel", "error", *inputs, "-filter_complex", graph, "-map", "[out]",
                        "-ac", "1", "-ar", "24000", "-t", f"{total:.3f}", str(audio)], check=True)
        # Cover: a frame near the end of the title scene, when the title is fully drawn and the pencil has left.
        jobs.append({"id": lid, "durs": durs, "audio": str(audio), "vtt": str(vtt), "out": str(outdir / f"{lid}.mp4"),
                     "cover": str(outdir / f"{lid}-cover.jpg"), "cover_t": round(scenes[0]["end"] - 0.4, 2)})
        print(f"{lid}: {total / 60:.1f} min, {sum(len(s['say']) for s in lesson['scenes'])} lines")

        draft = by_id[lid]
        draft["video"] = {"style": STYLE, "voice": voice_record(args.voice), "file": f"videos/{lid}.mp4",
                          "captions": f"videos/{lid}.vtt", "cover": f"videos/{lid}-cover.jpg", "duration_seconds": round(total, 1),
                          "scenes": [{"name": s["name"], "lines": [{"source": x.split("|", 1)[0], "text": x.split("|", 1)[1]}
                                                                   for x in s["say"]]} for s in lesson["scenes"]]}

    if args.demo_dir:
        print(f"Voice samples ({args.voice}): lesson data left unchanged")
    else:
        DRAFTS.write_text(json.dumps(drafts, ensure_ascii=False, indent=2) + ("\n" if drafts_raw.endswith("\n") else ""), encoding="utf-8")
        print(f"Updated video scripts in {DRAFTS.relative_to(ROOT)}")

    if args.no_render:
        return
    if not args.covers_only:
        cfg = CACHE / f"jobs{tag}.json"
        cfg.write_text(json.dumps({"ffmpeg": ff, "chrome": args.chrome, "fps": FPS, "workers": args.workers, "jobs": jobs}))
        subprocess.run(["node", "render.mjs", str(cfg)], cwd=HERE, check=True)
    for job in jobs:
        if not Path(job["out"]).exists():
            sys.exit(f"{job['id']}: no video to take a cover from ({job['out']})")
        subprocess.run([ff, "-y", "-loglevel", "error", "-ss", str(job["cover_t"]), "-i", job["out"], "-frames:v", "1",
                        "-q:v", "3", job["cover"]], check=True)
    print(f"Covers: {len(jobs)}")


if __name__ == "__main__":
    main()
