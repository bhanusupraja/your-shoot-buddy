# Your Study buddy — digital camera agent for solo creators

Your notebook idea, running end to end: the agent watches the live frame, listens to
what you say, and directs you by voice — like a cameraman standing next to the phone.

What it does (mapped to your notes):

- **Frame check** — says whether the frame is good; warns when you drift off-center,
  too far, too close, or out of frame entirely — but only when what you are
  saying actually needs you or the item on camera. Step out at such a moment
  and recording auto-pauses, resuming when you are back.
- **Missing-item voice alerts** — you say "biryani" but the dish is not on camera:
  it first tries a digital zoom toward it, then says
  *"Bhanu, biryani is not visible in the frame."*
- **Smart zoom** — talk about something visible and the recorded output zooms in;
  go quiet on it (~8 s) and it zooms back out to normal.
- **Content completeness** — for a recipe it tracks ingredient callouts and reminds
  you (*"you forgot to say about the ingredients: salt, water"*). Other templates
  track their own beats (vlog: intro → outro, review: unboxing → verdict…).
- **Any content type** — recipe was the example; templates for vlog, product
  review, how-to, and fully custom checklists ship in the box.
- **Photo mode** — ask "am I looking good" for a real frame/light/steadiness
  check plus occasion tips, then capture by voice ("capture me"), hand raise,
  button, or 5-shot burst. Every shot is scored, all are kept, the best is
  starred, and unclear shots trigger an instant re-take alert.
- **Voice both ways** — talk to it ("start", "stop", "capture me",
  "am I looking good") and it talks back; an occasion you already stated is
  never asked again. Quiet by default like Siri: chatty during setup, then
  silent unless something is wrong or you ask — switch to Full to narrate all.

## Run it (2 minutes)

Requirements: Node 18+ and Chrome or Edge (best mic + camera support).

```bash
cd solo-cameraman
npm test     # agent brain + proxy tests
npm start    # serves http://localhost:8081
```

Vision + reasoning run on Meta's Model API through the server, so set your key
first (PowerShell: `$env:MODEL_API_KEY="..."; npm start` — or `setx
MODEL_API_KEY "..."` once, then use a fresh terminal). Without a key the app
still runs fully on the simulator + typing. The key stays server-side: the
browser only ever talks to `/api/*` on localhost, never to Meta directly.

Open `http://localhost:8081` in the browser. Easiest flow is fully by voice:

1. Press **Talk** (allows the mic), then answer: “I want to record” or
   “I want to take photos”. Say the occasion (“birthday cake cutting”,
   “making biryani”) — it picks the template + checklist.
2. Say **“start camera”**, review the checklist (“add candles”,
   “remove onion”, or “looks good”), then say **“I'm ready”**.
3. During the session: “am I looking good” / “is this angle ok”,
   “capture” / “capture 5” (photos; voice or Capture button only — no auto-capture),
   “take a photo” during video saves a snapshot still below,
   “I'm going to fetch X” pauses missing-you alerts, “I'm back” resumes,
   “stop” to end. Skipped checklist beats are flagged in order at the end.
4. **Stop** → coverage summary + downloadable `.webm` (your voice and video;
   the agent's own prompts are muted out of the file) or scored
   photos with **Save best** / **Save all**.

### No camera / no mic? Still fully testable

- Tick **Simulate detections**, toggle person/subject, drag person position.
- Type in **Say it instead** instead of speaking, e.g.
  `now I add the onions to the biryani`, `where is my chicken`, `bye guys`.
- **Test voice alert** proves speech output works.

### Run on your phone

For phone testing, restart with LAN access (`HOST=0.0.0.0 npm start` on
Mac/Linux, `$env:HOST="0.0.0.0"; npm start` on Windows) — it prints a same-Wi-Fi
URL like `http://192.168.x.x:8081`; open it on the phone. (Some phones require
HTTPS for camera; then test direction + voice via simulator + typing, or use a
tunnel.)

### Install on iPhone (no App Store needed)

The deployed HTTPS link installs like an app: open it in **Safari** →
Share → **Add to Home Screen**. It launches fullscreen with the
Cameraman icon, and camera + mic work over HTTPS. (Native App Store
distribution is out of scope — this path needs no Apple account or review.)

### Deploy for judging (demo link)

Deploy `server.js` as-is to Render / Fly.io / Railway (all give automatic
HTTPS, which phones need for camera). Set these env vars on the host:

- `MODEL_API_KEY` — use a **separate demo-only key** (Meta dashboard), so you
  can delete it after judging without touching your main key.
- `DEMO_TOKEN` — a passcode judges append to the URL:
  `https://your-app.onrender.com/?token=judges-123`. The proxy rejects `/api/*`
  without it (401). Unset = open local dev.
- `DAILY_CALL_CAP` — upstream Meta calls/day before the proxy shows
  "demo paused" (default 2000 ≈ 1 camera-hour/day at the 4 s cadence).

Built-in protection (per Meta office hours): token gate + 120 req/min per IP
+ server-enforced SAM cadence (1 call per prompt per 4 s, so nobody can spam
SAM) + daily cap. Meta does not auto-stop at a spend amount — the proxy cap
is what protects your credits, plus a spend-limit alarm on the Billing page.
No CORS headers are sent (CORS only stops browsers, not scripts).

## Project layout

- `index.html` — session UI (setup, live camera, program output, transcript, log).
- `app.js` — camera/mic/detector/recording wiring + render loop.
- `agent-core.js` — the portable agent brain (no dependencies, UMD: browser + Node).
  Frame judge, topic tracker, digital-zoom controller, checklist, voice-alert
  policy with cooldowns. This is what the tests pin.
- `tests/core.test.js` — maintained suite (`node --test`), one flow per behavior.
- `server.js` — zero-dependency static server with phone-friendly LAN hints.

## Meta models (SAM + Spark) — live

TensorFlow is gone. Vision and reasoning run on Meta Model API
(`https://api.meta.ai/v1`, `Authorization: Bearer MODEL_API_KEY`):

- **SAM 3.1** (`sam-3.1`) — every 4 s the app snapshots the camera and asks for
  `person` + one subject noun (`biryani`, `cake`, or whatever focus object you
  mentioned). Boxes come back over the Responses API and feed the same frame
  judge, zoom, and alerts — no other changes needed.
- **Muse Spark** (`muse-spark-1.3`) — every transcript line also goes to Spark,
  which returns mentioned beats + one zoom focus as JSON. Keywords still cover
  each line instantly (and offline); Spark is the second opinion that catches
  phrasings keywords miss.
- **Key safety** — the key lives only in the server process (`MODEL_API_KEY`
  env var). The browser calls same-origin `/api/sam` and `/api/reason`; the
  proxy attaches the key. `/api/health` reports only whether a key is set.
- **Cost note** — roughly 2 SAM calls per 4 s of camera-on time plus 1 Spark
  call per spoken/typed line. Check pricing/rate limits on the Model API
  dashboard before a long session.
- **Voice** (still browser-native) — swap `speechSynthesis` /
  `SpeechRecognition` for streaming TTS/STT behind the same `speak()` /
  `handleLine()` boundary if you outgrow it.
- **Occasion knowledge** — beats ship built-in per template; a web-augmented
  backend can extend `checklistForTemplate()` with live search results behind
  the same array contract (browser CORS/API keys rule out direct search).
- **Faces + hands** — true smile/gaze/hair checks need a face-landmark
  model and robust gestures need a hand-pose model; both slot into
  `sampleFrame()` beside the current light/motion/skin heuristics.

## Troubleshooting

- Camera blocked → use `localhost` (not an IP) on desktop, allow permissions,
  or tick the simulator.
- Mic transcript empty → Chrome/Edge + HTTPS/localhost; otherwise type lines.
- Mic hears the app's own voice → the echo guard ignores mic input while the
  agent speaks (shown as “echo ignored”); earphones remove it fully.
- No camera vision → server has no `MODEL_API_KEY` (check its startup log); simulator covers every demo flow.
- Recording missing → Firefox/older browsers limit MediaRecorder; direction
  still works, video just won't save.
