# Kokoro voice service (Rheumy's Heart and Bella voices)

Turns Rheumy's answers into speech with Kokoro-82M (Apache-2.0), on our own machine or host.
The `rheumy-tts` Edge Function calls it for the `heart` and `bella` voices; Ava, Jenny and Emma
use Azure Speech. It is separate because Kokoro needs a 325 MB model and real CPU time, which
an Edge Function can't provide.

## Run on this computer

```bash
python3 -m venv services/kokoro-tts/.venv
services/kokoro-tts/.venv/bin/pip install -r services/kokoro-tts/requirements.txt
# model files (once): kokoro-v1.0.onnx and voices-v1.0.bin from
# https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 into a folder, e.g. services/kokoro-tts/models
KOKORO_TTS_KEY=<a long random string> services/kokoro-tts/.venv/bin/python services/kokoro-tts/server.py --models services/kokoro-tts/models
```

(`pipeline/lesson_video/.venv` and `.cache/kokoro` already have everything, so on this Mac:
`pipeline/lesson_video/.venv/bin/python services/kokoro-tts/server.py --models pipeline/lesson_video/.cache/kokoro --no-key`.)

`GET /health` answers `{"ok": true, ...}`; `POST /tts {"voice": "heart"|"bella", "text": "..."}` with header
`X-Kokoro-Key` returns MP3. Recent clips are kept in memory so a sentence the app asks for ahead plays at once.
Nothing is logged except the voice, the text length and the time taken.

## Speed

On this MacBook Air a sentence takes about 3 seconds and a whole answer about 0.6× its spoken length.
The app reads Heart and Bella answers sentence by sentence and asks for the next sentence while one plays,
so speech starts after about 3 to 6 seconds.

## Hosting (needed for the deployed website)

This is an always-on server, which the project rules exclude unless the team agrees. Options:
- A small container host (Docker, see `Dockerfile`), with at least 2 CPUs and 2 GB RAM.
- A Hugging Face Space (Docker type), free CPU tier, sleeps when idle.

Then set the Edge Function secrets `KOKORO_TTS_URL=https://<host>` and `KOKORO_TTS_KEY=<same key>`.
Without them, Heart and Bella answer "not set up" and the three Azure voices keep working.
