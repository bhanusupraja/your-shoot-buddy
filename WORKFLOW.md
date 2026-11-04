# Solo Cameraman — How It Works (Workflow)

One page that traces the whole system: what happens from the moment you speak
or the camera sees something, to the saved video. Code refs point at the
function that does each step.

## Big picture

```
You (voice + body + product)
  │ talk                    │ perform in front of fixed phone
  ▼                         ▼
Mic ──► SpeechRecognition   Camera ──► <video> ──► preview canvas (live view)
  │                                        │
  │ transcript line                        │ pixels (light/motion/skin) + JPEG snapshot/4s
  ▼                                        ▼
handleLine()                          /api/sam ×2 ──► Meta SAM 3.1 ──► boxes
  │                                        │
  ├─► commands (stop/capture/camera)       ▼
  ├─► setup chat (pre-session)        analyzeFrame() ──► issues (missing/off-center/close…)
  └─► session (mentions→tracker→       │
      checklist + Spark second         ├─► ZoomController ──► program canvas (what records)
      opinion via /api/reason)         ├─► AlertManager ──► voice correction (speechSynthesis)
                                       └─► RecordingPause ──► MediaRecorder pause/resume ──► .webm
```

Two canvases: **preview** (what the phone sees + overlays, never recorded)
and **program** (clean zoomed crop = what gets recorded and photographed).

## 1. "When I say something" — the voice path

1. **Capture** — `startListening()` (app.js): browser `SpeechRecognition`
   (continuous + interim). Interim words show on the "Hearing" line.
2. **Echo guard** — final results first pass two filters so the app never
   hears itself: a time window after it speaks (`echoSuppressMs`) and a
   long-overlap check (`isLikelyEcho`). Rejects show as `echo ignored`.
3. **Router** — `handleLine(text, source)`:
   - `stop` / `start` / `camera on-off` → session/camera commands.
   - `capture` → photo snap (photo mode) or video still (video mode).
   - `am I looking good` → `lookAnswer()` (frame + light + steadiness now).
   - `what did I forget…` → speaks the uncovered checklist beats.
   - `I'm going to fetch X` / `I'm back` → pauses/resumes missing-you alerts.
   - **Pre-session:** everything else → `setupUser()` (mode → occasion →
     checklist → say "looks good" to lock it → "I'm ready"). Nothing rolls
     before lock-in. Saying a new occasion or "new session" switches the
     checklist by default instead of sticking.
   - **In session:** mentions → `checklist.processText()` (ticks beats) →
     `tracker.update()` (sets the zoom topic, ~8s quiet releases it) →
     `sparkReason()` (async second opinion) → `tickAlerts()`.
4. **Spark second opinion** — `POST /api/reason {text, templateId, checklist}`
   → server prompts **Muse Spark** → `{mentioned[], focus}` → extra beats
   ticked, focus steers zoom if that object is visible. Keywords already
   covered the line instantly (and offline); Spark catches phrasings
   keywords miss.

## 2. "What the camera sees" — the vision path (every ~4s)

1. **Snapshot** — `samPoll()`: downscales the live frame to ≤480px JPEG.
2. **SAM calls** — `POST /api/sam {image, prompt}` twice: `person` plus one
   subject noun (recipe→`biryani`, photo-birthday→`cake`, photo-object→your
   subject, video product/tutorial/custom→whatever you're talking about if
   it's a concrete visible word like `handbag`). The server attaches
   `MODEL_API_KEY` and calls `POST https://api.meta.ai/v1/responses`
   (`sam-3.1`), then parses `<|box;…|>` into 0..1 bboxes. No key →
   simulator fallback; every flow still demos.
3. **Frame judge** — `analyzeFrame({detections, templateId})`: person
   placement (missing/off-center/too-small/too-close) + template subject
   (dish/product/demo/subject visible or not).
4. **Zoom** — `focusDetectionFor(activeTopic)` picks the box (talked-about
   subject wins; a product **held up near the face** wins even in silence
   via `isHeldNearFace`). `ZoomController`: products get tight fill framing
   (up to 3x, sized from the box); the person gets a gentle 1.7x push-in;
   quiet ~8s zooms back out.
5. **Alerts** — `AlertManager.decide()`: missing-you (only when the situation
   needs you), talked-about subject missing, skipped beats only (after 45s+;
   unreached trailing beats like the outro never nag mid-take),
   soft framing hints (lowest priority, once per episode).
6. **Recording gate** — `presenceNeeded()` decides who must be on camera
   (vlog: you always; product review: product always; tour/showing: you
   optional; otherwise self-talk/topic decides). `recordingBlocked()` pauses
   on needed-missing, cropped face, or bad light — and resumes into the
   **same file** when fixed. Soft drifts stay spoken hints so the video
   isn't chopped.

## 3. Recording path (video mode)

`startSession()` → opening voice plays → recorder rolls **after** the intro
finishes, so the file starts with you. Video = `program.captureStream(30)`;
audio = mic through a gain node that mutes sample-level while the agent
speaks — the saved `.webm` carries your voice only. `stop` → coverage
summary ("you covered X of Y… you forgot to say: …") + Save-video link.

## 4. Photo path (photo mode)

Occasion → shot list + tips (`selfie/birthday/group/object`). Capture by
voice ("capture", "capture 5"), button, or burst. Every shot is scored
(center/size/light/steadiness), all kept, best starred; unclear shots
trigger an instant re-take alert. Save best / save all as `.jpg`.

## 5. Session lifecycle

```
greet → mode? → occasion? → done ──("I'm ready")──► live ──("stop")──► finished
                                                    │ ▲                  │
                                              pause │ │ resume     new occasion /
                                              (rules│ │ (fixed)    "new session"
                                               broken)                  │
                                                        └──────► back to done
```

## 6. Key safety (for judges)

`MODEL_API_KEY` lives only in the server process env. The browser calls
same-origin `/api/sam`, `/api/reason`, `/api/health` — never Meta directly.
`/api/health` reports only whether a key is set. Snapshots are never stored.
