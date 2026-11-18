# Setting up your `.env` files

The real settings files (`.env`, `.env.local`) are **never in git**, so each person creates their own copy from the `.env.example` template next to it. Most people only need one file with two values.

## Which files do you need?

| You want to… | File to create | Template to copy | Secrets inside? |
|---|---|---|---|
| Run the app and try Rheumy | `frontend/.env.local` | `frontend/.env.example` | No: both values are public |
| Run backend scripts (import, publish, load Rheumy's passages, tests on the real database) | `.env` (repo root) | `.env.example` | **Yes** |
| Deploy Rheumy's server functions or change their keys | `backend/supabase/functions/.env` | `backend/supabase/functions/.env.example` | **Yes** |

**Always copy, never rename** the template (`cp`, not `mv`). The `.env.example` files are committed templates and must stay blank.

---

## 1. Run the app (everyone)

1. Copy the template:
   ```bash
   cp frontend/.env.example frontend/.env.local
   ```
2. Open `frontend/.env.local` and set:
   ```
   EXPO_PUBLIC_CONTENT_SOURCE=preview
   EXPO_PUBLIC_SUPABASE_URL=https://alpetpnxseatkdudqpue.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key: ask in the team channel>
   ```
   - `preview` shows the 24 draft lessons (team review only, not clinically reviewed). `mock` shows the backend's two sample lessons with a working quiz.
   - The publishable key starts with `sb_publishable_`. It is public by design (it ships inside every app build), so it's fine to share in the team channel. **Never** put a key starting with `sb_secret_` here.
3. Start the app:
   ```bash
   cd frontend
   npm install
   npx expo start --web --port 8081
   ```
   Use port **8081**: Rheumy only accepts browser requests from addresses on its allowlist, and `http://localhost:8081` is on it.
4. Check: tap the round Rheumy button (bottom right) and ask "What is psoriatic arthritis?". You should get an answer with "Where this comes from" citations.

**You do not need** the Groq or Azure keys: they are stored on the Supabase server, and your app uses them through Rheumy's server functions.

### If something's wrong

| You see | Fix |
|---|---|
| "Rheumy isn't set up in this build" | One of the two Supabase values is missing. Fill them in and **restart** `npx expo start` (changes are only read at start). |
| "Not set up correctly" after asking | The key is wrong, or you used a different port. Use port 8081, or ask for your address to be added to `RHEUMY_ALLOWED_ORIGINS`. |
| "Rheumy is busy right now" | The free AI plan allows about 3 questions a minute. Wait a minute. |
| Heart or Bella "aren't available yet" | Expected: their voice service isn't hosted yet. Use Ava, Jenny or Emma. |

---

## 2. Backend scripts (Backend Lead, or whoever loads data)

1. Copy the template:
   ```bash
   cp .env.example .env
   ```
2. Fill in from the Supabase dashboard (project `alpetpnxseatkdudqpue`):

   | Setting | Where to find it |
   |---|---|
   | `SUPABASE_URL` | `https://alpetpnxseatkdudqpue.supabase.co` |
   | `SUPABASE_ANON_KEY` | Project Settings → API Keys → **publishable** key |
   | `SUPABASE_SERVICE_KEY` | Project Settings → API Keys → **secret** key (`sb_secret_...`) |
   | `SUPABASE_DB_URL` | **Connect** button (top of the dashboard) → connection string, with the database password filled in |
   | `SUPABASE_ACCESS_TOKEN` | Only for deploying functions or setting secrets: create your own at <https://supabase.com/dashboard/account/tokens> (Resource access: **Project** → our project; it expires, which is good) |

   You need to be a member of the team's Supabase organization to see these pages. Ask the Backend Lead for an invite.
3. Check: `backend/.venv/bin/python backend/scripts/rheumy_smoke.py` should end with "all checks passed".

---

## 3. Rheumy's server keys (only the person deploying)

These keys live as **Supabase Edge Function secrets**. The local file is only used to upload them, or to run the functions on your computer.

1. Copy the template:
   ```bash
   cp backend/supabase/functions/.env.example backend/supabase/functions/.env
   ```
2. Fill in:

   | Setting | Where to get it |
   |---|---|
   | `GROQ_API_KEY` | <https://console.groq.com/keys> → Create API Key (shown once). Turn on Zero Data Retention at <https://console.groq.com/settings/data-controls>. |
   | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Azure portal → our Speech resource → **Keys and Endpoint** → KEY 1 and Location/Region (`eastus`) |
   | `KOKORO_TTS_URL`, `KOKORO_TTS_KEY` | Leave empty until the Kokoro voice service is hosted (see `services/kokoro-tts/README.md`) |
   | `RHEUMY_ALLOWED_ORIGINS` | Addresses allowed to call Rheumy, comma-separated, no trailing slash, e.g. `https://our-site.example,http://localhost:8081` |
3. Test the Groq and Azure keys on their own:
   ```bash
   backend/.venv/bin/python backend/scripts/rheumy_smoke.py --direct
   ```
4. Upload only the values you filled in, then deploy. Full steps are in [rheumy-chatbot.md](rheumy-chatbot.md), section 3.

---

## Rules

- **Never commit** `.env`, `.env.local` or `functions/.env`. Git already ignores them. If `git status` ever shows one, stop and ask.
- **Keep every `.env.example` blank.** If you typed real values into one, move them to the real file and restore the template: `git checkout -- .env.example`.
- **Share secrets privately** (a password manager or a direct message), never in the group chat, an issue or a document. Prefer each person creating their own Supabase access token.
- **Only `EXPO_PUBLIC_` values go in the app,** and only public ones. Anything in `frontend/.env.local` ends up in the built website for anyone to read.
- **If a secret leaks,** rotate it right away: Groq (delete the key and create a new one), Azure (Regenerate Key 1), Supabase (API Keys → roll the secret key, then update everyone's `.env` and the Edge secrets).
