# Solo Cameraman — submission notes (Meta Global AI Hackathon)

Browser digital camera agent for solo creators. You talk to it, it directs the
shoot out loud: framing fixes, auto zoom onto what you show or mention,
checklist tracking ("you forgot the outro"), and it pauses the recording over
bad takes so the saved file skips dead air. Photos and video, one page.

## Meta models only

Two Meta models, both through the Meta Model API, nothing else:

- **SAM 3.1** — eyes. Every 4s the page sends one 640px frame to our proxy,
  which asks SAM for `person` + one subject prompt (what you are holding or
  talking about). Boxes drive framing checks, zoom, pause, and capture gates.
- **Muse Spark** — second opinion on language. Speech transcripts go to the
  proxy, Spark returns mentioned beats + a zoom focus. Keyword matching covers
  the same lines instantly (and offline); Spark refines.

No TensorFlow, no third-party vision/LLM. The browser never sees the API key:
page → same-origin `/api/sam`, `/api/reason` → `https://api.meta.ai/v1`.
Demo guard per Yash's review: judge link carries `?token=…`, proxy rejects
without it, per-IP rate limit, 4s SAM cadence enforced server-side, daily call
cap with a "demo paused" message, demo-only key deleted after judging.

## What we built

- Voice setup: photos or video → occasion → template checklist → `looks good`
  lock before anything rolls. Occasion switches rebuild the checklist.
- Live direction: missing / half-out / cropped / off-center / light alerts,
  spoken in quiet mode only when something needs fixing. Checklist reminders
  only nag about beats you jumped over (never the still-ahead outro);
  anything unsaid is listed at Stop.
- Auto zoom (no toggle, always on): hold a product near your face or name a
  visible object; it frames the object alone (up to 3x), zooms back out when
  taken away or the topic goes quiet.
- Pause-into-same-file: broken shots and forgotten beats pause the recorder
  (red banner, voice tells you why); fixed shots resume into the same file.
  Agent-speech time is cut from the file, and answering a reminder rolls again
  silently so your words are saved.
- Photo mode: `capture me` captures from anywhere; birthday refuses without a
  cake in frame; every shot scored, best starred, save best/all.
- Simple demo view for judges: `?view=simple` (or the topbar button) keeps
  only talk panel, cameras, director line, and checklist.
- Installable on iPhone via Add to Home Screen (manifest + icons, no App
  Store). Gmail login deferred — needs your Google Client ID.

## Run it

```
npm start            # needs MODEL_API_KEY in env (demo-only key)
```

Open `http://localhost:8081` — judges: `https://<your-host>/?token=…&view=simple`.
Full run/deploy/troubleshooting: [README.md](README.md). Every behavior change:
[CHANGELOG.md](CHANGELOG.md). End-to-end workflow: [WORKFLOW.md](WORKFLOW.md).

## Repo map

- `index.html`, `styles.css`, `app.js` — page, style, wiring (speech, recorder,
  zoom render, pause gate, photo capture).
- `agent-core.js` — pure brain (frame judge, zoom, alerts, checklist, pause
  gate, echo/parrot guards) + its tests.
- `server.js` — static host + `/api/sam`, `/api/reason`, `/api/health` proxy
  with token / rate-limit / cadence / daily-cap guards.
- `tests/` — `node --test tests/core.test.js tests/wiring.test.js tests/proxy.test.js`.
- `manifest.json`, `icon-*.png` — installable web app.
- `videos/`, `images/` — saved takes and captures (local only).

## Submission checklist

- [x] Open-source repo, key never in code/frontend/video
- [x] Live demo link path (token + simple view)
- [ ] 3-minute demo video (record yours — keep key/token out of frame)
- [ ] Push public + submit before Nov 4, 9:00 PM ET, then delete the demo key
