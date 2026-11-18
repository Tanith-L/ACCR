"""Real-request checks for the Rheumy chatbot (docs/rheumy-chatbot.md, step 6).

    python backend/scripts/rheumy_smoke.py --direct      # test the Groq and Azure keys themselves
    python backend/scripts/rheumy_smoke.py               # test the deployed Edge Functions
    python backend/scripts/rheumy_smoke.py --origin https://rheumnotes.example.org

--direct reads GROQ_API_KEY, AZURE_SPEECH_KEY and AZURE_SPEECH_REGION from
backend/supabase/functions/.env (or the environment) and calls Groq and Azure
directly, so the keys can be checked before Supabase is set up.

The default mode calls the deployed functions the way the app does, with
SUPABASE_URL and SUPABASE_ANON_KEY (publishable key) from .env: a CORS preflight,
a real question, an emergency question and a text-to-speech request. With --origin
it sends that Origin header, as the hosted website will.

Each check prints PASS or FAIL; the exit code is the number of failures. Secrets are
never printed.
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from contract import find_upwards


def _ssl_context() -> ssl.SSLContext:
    """Trusted certificates from certifi when installed: python.org builds of Python on
    macOS don't use the system's certificates, so HTTPS fails without this."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


SSL_CONTEXT = _ssl_context()

HERE = Path(__file__).resolve().parent
FUNCTIONS_ENV = HERE.parent / "supabase" / "functions" / ".env"
QUESTION = "Why can PsA cause heel pain?"


def settings() -> dict:
    from dotenv import dotenv_values

    values: dict = {}
    root_env = find_upwards(HERE, ".env")
    for f in (root_env, FUNCTIONS_ENV):
        if f and f.is_file():
            values.update({k: v for k, v in dotenv_values(f).items() if v})
    values.update({k: v for k, v in os.environ.items() if v})
    return values


def request(url: str, *, method: str = "GET", headers: dict | None = None, body: bytes | None = None,
            timeout: int = 60) -> tuple[int, dict, bytes]:
    # A named client: Groq's Cloudflare front end refuses Python's default "Python-urllib" (error 1010).
    req = urllib.request.Request(url, data=body, method=method, headers={"User-Agent": "rheumnotes-scripts/1.0", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()


class Report:
    def __init__(self) -> None:
        self.failures = 0

    def check(self, name: str, ok: bool, detail: str = "") -> bool:
        print(f"{'PASS' if ok else 'FAIL'}  {name}{f' - {detail}' if detail else ''}")
        self.failures += 0 if ok else 1
        return ok


def direct(s: dict, rep: Report) -> None:
    key = s.get("GROQ_API_KEY")
    if rep.check("GROQ_API_KEY is set", bool(key)):
        model = s.get("GROQ_MODEL") or "openai/gpt-oss-120b"
        t = time.time()
        status, _, body = request("https://api.groq.com/openai/v1/chat/completions", method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            body=json.dumps({"model": model, "temperature": 0.2, "max_completion_tokens": 200,
                             **({"reasoning_effort": "low"} if model.startswith("openai/gpt-oss") else {}),
                             "messages": [{"role": "user", "content": "In one sentence: what is a joint?"}]}).encode())
        text = ""
        if status == 200:
            text = (json.loads(body).get("choices") or [{}])[0].get("message", {}).get("content", "") or ""
        rep.check(f"Groq {model} answers", status == 200 and bool(text.strip()),
                  f"HTTP {status}, {time.time() - t:.1f}s" + (f": {text.strip()[:80]!r}" if text else f": {body[:200]!r}"))

    akey, region = s.get("AZURE_SPEECH_KEY"), (s.get("AZURE_SPEECH_REGION") or "").lower()
    if rep.check("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are set", bool(akey and region)):
        status, _, token = request(f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken", method="POST",
                                   headers={"Ocp-Apim-Subscription-Key": akey, "Content-Length": "0"})
        if rep.check("Azure issues a speech token", status == 200, f"HTTP {status}"):
            for voice in ("en-US-AvaMultilingualNeural", "en-US-JennyNeural", "en-US-EmmaNeural"):
                ssml = (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">'
                        f'<voice name="{voice}">Hello, I am Rheumy.</voice></speak>')
                status, headers, audio = request(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
                    method="POST", body=ssml.encode(), headers={
                        "Authorization": f"Bearer {token.decode()}", "Content-Type": "application/ssml+xml",
                        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "rheumnotes-smoke"})
                rep.check(f"Azure speaks with {voice}", status == 200 and len(audio) > 2000,
                          f"HTTP {status}, {len(audio)} bytes, {headers.get('content-type', '?')}")


def deployed(s: dict, origin: str | None, rep: Report) -> None:
    url, key = (s.get("SUPABASE_URL") or "").rstrip("/"), s.get("SUPABASE_ANON_KEY")
    if not rep.check("SUPABASE_URL and SUPABASE_ANON_KEY are set", bool(url and key)):
        return
    base = f"{url}/functions/v1"
    hdr = {"apikey": key, "Content-Type": "application/json",
           **({"Authorization": f"Bearer {key}"} if key.count(".") == 2 else {}),
           **({"Origin": origin} if origin else {})}

    if origin:
        status, h, _ = request(f"{base}/rheumy-chat", method="OPTIONS", headers={
            "Origin": origin, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "apikey, content-type"})
        allowed = h.get("access-control-allow-origin")
        rep.check(f"CORS preflight allows {origin}", status in (200, 204) and allowed in ("*", origin),
                  f"HTTP {status}, Access-Control-Allow-Origin: {allowed}")

    t = time.time()
    status, h, body = request(f"{base}/rheumy-chat", method="POST", headers=hdr,
                              body=json.dumps({"messages": [{"role": "user", "content": QUESTION}]}).encode())
    data = json.loads(body or b"{}") if h.get("content-type", "").startswith("application/json") else {}
    answered = status == 200 and bool(data.get("answer"))
    rep.check("rheumy-chat answers a question", answered,
              f"HTTP {status}, {time.time() - t:.1f}s" + ("" if answered else f": {body[:300]!r}"))
    if answered:
        rep.check("the answer cites lessons or sources", bool(data.get("citations")),
                  ", ".join(f"[{c['n']}] {c['title']}" for c in data.get("citations", []))[:200])
        print(f"      answer: {data['answer'][:300]!r}")
        if origin:
            rep.check("the answer response carries CORS headers", h.get("access-control-allow-origin") in ("*", origin))

    status, _, body = request(f"{base}/rheumy-chat", method="POST", headers=hdr,
                              body=json.dumps({"messages": [{"role": "user", "content": "I have chest pain and can't breathe"}]}).encode())
    data = json.loads(body or b"{}") if status == 200 else {}
    rep.check("an emergency gets the fixed 911 reply", data.get("urgency") == "emergency" and "911" in data.get("answer", ""),
              f"HTTP {status}")

    q = urllib.parse.urlencode({"voice": "jenny", "text": "Hello, I am Rheumy.", "apikey": key})
    status, h, audio = request(f"{base}/rheumy-tts?{q}", headers={"Origin": origin} if origin else {})
    rep.check("rheumy-tts returns playable MP3 audio", status == 200 and h.get("content-type") == "audio/mpeg" and len(audio) > 2000,
              f"HTTP {status}, {h.get('content-type')}, {len(audio)} bytes" + ("" if status == 200 else f": {audio[:200]!r}"))

    status, _, _ = request(f"{base}/rheumy-chat", method="POST", headers={"Content-Type": "application/json"},
                           body=b'{"messages":[{"role":"user","content":"hi"}]}')
    rep.check("requests without the key are refused", status == 401, f"HTTP {status}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--direct", action="store_true", help="test the Groq and Azure keys directly")
    ap.add_argument("--origin", help="send this Origin header (the hosted site's address) to test CORS")
    args = ap.parse_args(argv)
    rep = Report()
    s = settings()
    if args.direct:
        direct(s, rep)
    else:
        deployed(s, args.origin, rep)
    print(f"\n{rep.failures} failed" if rep.failures else "\nall checks passed")
    return rep.failures


if __name__ == "__main__":
    sys.exit(main())
