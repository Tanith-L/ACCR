"""Kokoro text-to-speech service for Rheumy's Heart and Bella voices (docs/rheumy-chatbot.md).

Kokoro-82M (Apache-2.0) runs here, on our own machine or host; nothing is sent to a
third party. The rheumy-tts Edge Function calls it for the `heart` and `bella` voices;
Ava, Jenny and Emma go to Azure. Kokoro needs a 325 MB model and real CPU time, which
is why it is a separate service and not part of the Edge Function.

    python services/kokoro-tts/server.py --models pipeline/lesson_video/.cache/kokoro --port 8788

    GET  /health                                  -> {"ok": true, "voices": ["heart", "bella"]}
    POST /tts  {"voice": "heart", "text": "..."}  -> audio/mpeg (or audio/wav without ffmpeg)
         header X-Kokoro-Key: <KOKORO_TTS_KEY>

Settings: KOKORO_TTS_KEY (required unless --no-key, which is only for localhost),
KOKORO_MODELS (folder with kokoro-v1.0.onnx and voices-v1.0.bin), PORT.
"""
from __future__ import annotations

import argparse
import hmac
import io
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VOICES = {"heart": "af_heart", "bella": "af_bella"}
SPEED = 0.95
MAX_CHARS = 1500
# Spoken forms Kokoro gets wrong otherwise (checked with its phonemizer; same list as
# pipeline/lesson_video/build_videos.py).
ABBREVIATIONS = (  # case-sensitive: read letter by letter
    (r"\bPsA\b", "P-S-A"), (r"\bRF\b", "R-F"), (r"\bDMARDs\b", "D-mards"), (r"\bSI\b", "S-I"),
    (r"\bMDA\b", "M-D-A"), (r"\bIBD\b", "I-B-D"),
)
WORDS = (  # any case
    (r"\buveitis\b", "youvee-itis"), (r"\bpsoriasis\b", "so-rye-a-sis"), (r"\bsacroiliac\b", "sacro-iliac"),
)


def spoken(text: str) -> str:
    text = re.sub(r"\[\d{1,2}\]", "", text)          # citation marks
    text = re.sub(r"[*_#`>]+", "", text)              # Markdown
    for pattern, said in ABBREVIATIONS:
        text = re.sub(pattern, said, text)
    for pattern, said in WORDS:
        text = re.sub(pattern, said, text, flags=re.IGNORECASE)
    return re.sub(r"\s{2,}", " ", text).strip()


def ffmpeg_path() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None


class Engine:
    def __init__(self, models: Path):
        import soundfile  # noqa: F401  (fail at start, not on the first request)
        from kokoro_onnx import Kokoro

        onnx, voices = models / "kokoro-v1.0.onnx", models / "voices-v1.0.bin"
        missing = [p.name for p in (onnx, voices) if not p.is_file()]
        if missing:
            sys.exit(f"Kokoro model files missing in {models}: {', '.join(missing)}. Download them from "
                     "https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0")
        self.model = Kokoro(str(onnx), str(voices))
        self.lock = threading.Lock()  # one synthesis at a time: it already uses every core
        self.ffmpeg = ffmpeg_path()
        # Recent clips, so a sentence the app fetched ahead plays at once (memory only).
        self.cache: OrderedDict[tuple[str, str], tuple[bytes, str]] = OrderedDict()

    def speak(self, text: str, voice: str) -> tuple[bytes, str]:
        import soundfile

        key = (voice, spoken(text))
        with self.lock:  # checked inside the lock: a request for a clip being made waits, then reuses it
            if key in self.cache:
                self.cache.move_to_end(key)
                return self.cache[key]
            audio, rate = self.model.create(key[1], voice=VOICES[voice], speed=SPEED, lang="en-us")
            wav = io.BytesIO()
            soundfile.write(wav, audio, rate, format="WAV", subtype="PCM_16")
            result = (wav.getvalue(), "audio/wav")
            if self.ffmpeg:
                mp3 = subprocess.run([self.ffmpeg, "-loglevel", "error", "-i", "pipe:0", "-f", "mp3", "-b:a", "64k", "pipe:1"],
                                     input=wav.getvalue(), capture_output=True, check=True).stdout
                result = (mp3, "audio/mpeg")
            self.cache[key] = result
            if len(self.cache) > 200:
                self.cache.popitem(last=False)
            return result


def make_handler(engine: Engine, key: str | None):
    class Handler(BaseHTTPRequestHandler):
        server_version = "rheumy-kokoro/1.0"

        def _json(self, status: int, body: dict) -> None:
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:  # noqa: N802
            if self.path.rstrip("/") == "/health":
                return self._json(200, {"ok": True, "voices": sorted(VOICES)})
            self._json(404, {"error": "not_found"})

        def do_POST(self) -> None:  # noqa: N802
            if self.path.rstrip("/") != "/tts":
                return self._json(404, {"error": "not_found"})
            if key and not hmac.compare_digest(self.headers.get("X-Kokoro-Key", ""), key):
                return self._json(401, {"error": "unauthorized"})
            try:
                body = json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 20_000)) or b"{}")
            except (ValueError, json.JSONDecodeError):
                return self._json(400, {"error": "bad_request", "message": "Body must be JSON."})
            voice, text = body.get("voice"), (body.get("text") or "").strip()
            if voice not in VOICES:
                return self._json(400, {"error": "bad_request", "message": f"voice must be one of: {', '.join(VOICES)}"})
            if not text or len(text) > MAX_CHARS:
                return self._json(400, {"error": "bad_request", "message": f"text must be 1 to {MAX_CHARS} characters"})
            started = time.time()
            try:
                audio, content_type = engine.speak(text, voice)
            except Exception as e:  # report, don't crash the server
                print(f"synthesis failed: {e}", file=sys.stderr)
                return self._json(500, {"error": "server_error"})
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
            print(f"{voice}: {len(text)} chars -> {len(audio) // 1024} KB in {time.time() - started:.1f}s")

        def log_message(self, *args) -> None:  # requests are summarized above; no text is logged
            pass

    return Handler


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--models", type=Path, default=Path(os.environ.get("KOKORO_MODELS", "models")))
    ap.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8788)))
    ap.add_argument("--no-key", action="store_true", help="accept requests without a key (localhost only)")
    args = ap.parse_args()

    key = os.environ.get("KOKORO_TTS_KEY", "").strip() or None
    if not key and not args.no_key:
        print("ERROR: set KOKORO_TTS_KEY (or use --no-key on localhost)", file=sys.stderr)
        return 2
    if args.no_key and args.host not in ("127.0.0.1", "localhost"):
        print("ERROR: --no-key is only allowed on localhost", file=sys.stderr)
        return 2
    engine = Engine(args.models)
    print(f"Kokoro TTS on http://{args.host}:{args.port} (voices: heart, bella; "
          f"{'mp3' if engine.ffmpeg else 'wav'} output; key {'required' if key else 'not required'})")
    ThreadingHTTPServer((args.host, args.port), make_handler(engine, key)).serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
