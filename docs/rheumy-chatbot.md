# Rheumy chatbot: setup, credentials and deployment

Rheumy is the app's PsA learning assistant. It answers questions from the RheumNotes lessons and the source documents they cite, shows where each answer comes from, and can read answers aloud in the Ava, Jenny or Emma voice.

**Status: demo only.** The lessons are `checked` drafts and the source documents are written for clinicians; none of it is clinically reviewed yet (Rubric B pending). Use Rheumy for team and client demonstrations, not with patients, until Dr. Murphy and the team approve it. Nothing a user types is stored.

## 1. How it fits together

```
Website / phone app (frontend: floating Rheumy button on every screen)
   │  apikey: publishable key (public)          ← the only key in the app
   ▼
Supabase Edge Functions (backend/supabase/functions)
   ├─ rheumy-chat   question → scrub personal details → emergency check
   │                → gte-small embedding (built into Supabase, no key)
   │                → rheumy_search (pgvector + keyword, migration 0009)
   │                → Groq LLM (GROQ_API_KEY)  → answer + citations
   ├─ rheumy-tts    answer text → Azure AI Speech (AZURE_SPEECH_KEY) → MP3
   └─ rheumy-ingest passages from backend/scripts/rheumy_ingest.py → embeddings → table
Supabase Postgres: public.rheumy_chunks (RLS on, no policies; only the functions read it)
```

| Service | What for | Free tier (checked 2026-11-18 against the providers' own pages) | Key needed |
|---|---|---|---|
| **Groq**, model `openai/gpt-oss-120b` | Writing answers | Free plan: 30 requests/min, 1,000 requests/day, 8,000 tokens/min, 200,000 tokens/day for this model ([rate limits](https://console.groq.com/docs/rate-limits); your exact limits are in the console) | `GROQ_API_KEY` |
| **Azure AI Speech** (F0) | Reading answers aloud | 0.5 million characters/month of neural text to speech, 20 requests per 60 seconds, not adjustable ([pricing](https://azure.microsoft.com/en-us/pricing/details/speech/), [quotas](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits)) | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` |
| **Supabase** (free plan) | Database, search, Edge Functions, embeddings | gte-small embeddings run inside Edge Functions at no extra cost ([AI models](https://supabase.com/docs/guides/functions/ai-models)) | Project URL, publishable key, secret key |
| **Kokoro-82M** (`af_heart`, `af_bella`) | Offline narration samples for the lesson videos | Open source (Apache-2.0), runs on our computer | none |

### Why Groq and not Gemini Flash

Both were checked against their official terms on 2026-11-18.

- **Gemini API free tier** ([terms](https://ai.google.dev/gemini-api/terms), effective 2026-03-23): Google uses free-tier prompts and responses to improve its products and "human reviewers may read, annotate, and process your API input and output". The terms also say not to submit sensitive or personal information to the free tier, not to use the API "to provide medical advice", and not to build for people under 18. Only the paid tier stops the training use. Not suitable for patient questions.
- **Groq** ([Services Agreement](https://console.groq.com/docs/legal/services-agreement), last modified 2026-06-22; [Your Data](https://console.groq.com/docs/your-data)): "Groq is not permitted to use Inputs or Outputs for training", inference data is not retained by default (up to 30 days only for abuse investigation), and **Zero Data Retention** can be turned on. It is also very fast and OpenAI-compatible.
- Groq's terms still apply: users must be 18+, the service is "not for consumer use", it "should not be used for medical, legal, financial, or other professional advice", and PHI needs a Business Associate Addendum. That is why Rheumy is a demo, teaches rather than advises, and strips personal details. **Patient use needs the team's and Dr. Murphy's sign-off and a BAA review first.**

### Why Azure for the chat voices, and Kokoro only offline

Ava, Jenny and Emma are Microsoft voices. The lesson videos made them through the unofficial `edge-tts` client, which Microsoft says is not for commercial use; the chatbot uses the **official Azure Speech REST API** instead. All three are listed for en-US in [Azure's voice list](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts): `en-US-AvaMultilingualNeural`, `en-US-JennyNeural`, `en-US-EmmaNeural`.

Kokoro (`af_heart`, `af_bella`) is installed in `pipeline/lesson_video/.venv` with its model in `pipeline/lesson_video/.cache/kokoro/`, and its voice samples are in `frontend/assets/voice-demo/heart` and `/bella`. Kokoro needs a 325 MB model and real CPU time, so it can't run inside an Edge Function; live Kokoro answers would need an always-on server, which the project rules exclude. Options for later: run Kokoro in the browser (`kokoro-js`, large download per visitor) or host one small server for it.

## 2. Get the credentials (you do these steps)

### 2.1 Groq API key
1. Go to <https://console.groq.com> and sign in (Google, GitHub or email). Groq's billing FAQ says a payment method is only needed to upgrade from the Free tier.
2. Open <https://console.groq.com/keys> → **Create API Key** → name it `rheumnotes-rheumy` → **Submit**. Copy the key now; it is shown only once.
3. Turn on Zero Data Retention: <https://console.groq.com/settings/data-controls> → enable **Zero Data Retention** (Console › Settings › Data Controls).
4. Check your limits at <https://console.groq.com/settings/limits>.

### 2.2 Azure AI Speech key and region
1. Sign in at <https://portal.azure.com>. With no subscription yet: CMU students can use **Azure for Students** (<https://azure.microsoft.com/free/students>, sign up with your andrew.cmu.edu address), otherwise the free account at <https://azure.microsoft.com/free> (Azure may ask for a payment method to verify identity; the F0 tier itself is free).
2. **Create a resource** → search **Speech** → choose **Speech** (Azure AI services) → **Create**.
3. Subscription: yours. Resource group: create `rheumnotes`. Region: **East US** (`eastus`). Name: e.g. `rheumnotes-speech`. Pricing tier: **Free F0**. → **Review + create** → **Create**.
4. When it's deployed: **Go to resource** → **Keys and Endpoint**. Copy **KEY 1** (that's `AZURE_SPEECH_KEY`) and **Location/Region** (`eastus`, that's `AZURE_SPEECH_REGION`).

### 2.3 Supabase project
Reuse the team project if it exists: ask Vanshika (Backend Lead) for the project ref, URL, publishable key and secret key. No project yet? Create one at <https://supabase.com/dashboard> → **New project** (free plan, region US East). Then **Project Settings → API Keys**: the **publishable** key (`sb_publishable_...`) goes in the app; the **secret** key (`sb_secret_...`) stays on your computer for the ingest script and must never go in the app or git.

### 2.4 Where each value goes

| Value | Put it in | Never in |
|---|---|---|
| `GROQ_API_KEY`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `RHEUMY_ALLOWED_ORIGINS` | Supabase Edge Function secrets (and `backend/supabase/functions/.env` locally, git-ignored) | the app, git |
| Supabase URL + **publishable** key | `frontend/.env.local` as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`; root `.env` as `SUPABASE_URL` / `SUPABASE_ANON_KEY` | — (public by design) |
| Supabase **secret** key, DB URL | root `.env` as `SUPABASE_SERVICE_KEY` / `SUPABASE_DB_URL` (git-ignored) | the app, git, Edge secrets (provided automatically) |

## 3. Set up the backend (commands from the repository root)

The Supabase CLI runs through npm: `npx supabase@2 ...` (Homebrew needs newer Xcode tools on this Mac).

```bash
# 0. Test the Groq and Azure keys on their own first
cp backend/supabase/functions/.env.example backend/supabase/functions/.env   # then fill it in
backend/.venv/bin/python backend/scripts/rheumy_smoke.py --direct

# 1. Link the project
npx supabase@2 login
npx supabase@2 link --project-ref <project-ref> --workdir backend

# 2. Database: apply migration 0009 (pgvector table + search function)
npx supabase@2 db push --workdir backend
#    If earlier migrations were pasted into the SQL editor (no migration history),
#    paste backend/supabase/migrations/0009_rheumy_rag.sql into the SQL editor instead.

# 3. Secrets (no redeploy needed when they change)
npx supabase@2 secrets set --env-file backend/supabase/functions/.env --workdir backend

# 4. Deploy the three functions
npx supabase@2 functions deploy rheumy-chat rheumy-tts rheumy-ingest --workdir backend

# 5. Load the passages (813 from 24 lessons and 9 source documents)
backend/.venv/bin/python backend/scripts/rheumy_ingest.py --dry-run
backend/.venv/bin/python backend/scripts/rheumy_ingest.py

# 6. Real-request checks against the deployed functions
backend/.venv/bin/python backend/scripts/rheumy_smoke.py
```

Re-run step 5 whenever lessons or sources change; unchanged passages aren't re-embedded and removed ones are deleted.

## 4. Frontend

`frontend/.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Restart `npx expo start`. Rheumy is a floating button (bottom right, above the tab bar) on every screen except the one-time welcome screen; it opens the chat as a sheet, and closing the sheet keeps the conversation until the app is closed. Without these two values the chat says exactly which setting is missing. If the server is missing a secret, the chat replies that it isn't set up and the function's 503 response lists the missing names.

## 5. Deploy the website

1. Build: `cd frontend && npx expo export --platform web` writes a static site to `frontend/dist/` (about 81 MB, mostly lesson videos). The two `EXPO_PUBLIC_` values are baked in at build time.
2. Host `dist/` on any static host over HTTPS, with every path falling back to `index.html` (single-page app): EAS Hosting (`npx eas-cli@latest deploy`), Netlify (`_redirects`: `/* /index.html 200`) or Vercel (rewrite all to `/index.html`).
3. Add the site's address to the CORS allowlist and check from the real origin:
   ```bash
   npx supabase@2 secrets set RHEUMY_ALLOWED_ORIGINS=https://<your-site>,http://localhost:8081 --workdir backend
   backend/.venv/bin/python backend/scripts/rheumy_smoke.py --origin https://<your-site>
   ```
4. On the live site: ask a suggested question, open a cited lesson, press **Listen** with each voice (audio starts only after a tap, as browsers require).

Nothing points at localhost: the app calls `https://<project-ref>.supabase.co/functions/v1/...`, which is hosted by Supabase. The services deployed independently are the static website, the Supabase project (database + three functions), and the two external accounts (Groq, Azure).

Note: in `preview` content mode the web build contains the draft lessons. Share the demo URL only with the team and client.

## 6. Safety and privacy built in

- **No storage**: no chat table, no logs of questions (errors log only status codes).
- **Personal details removed** on the server before the LLM call (emails, phone numbers, dates, long numbers, street addresses), and the app asks people not to type them.
- **Emergencies** (chest pain, trouble breathing, vision loss, self-harm…) get a fixed "call 911 / 988" reply with no LLM call. **Same-day** symptoms (eye pain or redness, fever with a hot swollen joint…) get an extra notice under the answer.
- **Grounded answers**: the model may use only the retrieved passages, must cite them, must say when RheumNotes doesn't cover something, and must not diagnose, name drugs or give doses.
- **Keys**: only the publishable key is in the app; Groq/Azure keys are Edge secrets; the ingest function accepts only the secret key; `rheumy_chunks` and `rheumy_search` are closed to anon/authenticated.
- **Abuse limits**: per-IP limits in each function, 600-character questions, 1,500-character speech requests; Groq and Azure enforce their own quotas.

## 7. Tests

```bash
deno test backend/supabase/functions/tests/          # prompt, safety, scrubbing, citations, SSML
deno check backend/supabase/functions/rheumy-*/index.ts
backend/.venv/bin/python -m pytest backend/tests/test_rheumy_ingest.py -q
cd frontend && npm test -- rheumy                     # client: config, errors, audio URL
```
