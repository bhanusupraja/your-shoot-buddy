# SoloDirectorAI — Skills

## 1. What this file is
Skills used by the project, skills used by the app, and skills the creator needs. For submission, this shows Meta AI tooling use, technical depth, and what is honestly MVP vs stretch.

## 2. Meta AI skills used by the app
### SAM 3.1 — Seeing skill
- What: Segment / box a person or an item in a captured photo
- How: POST https://api.meta.ai/v1/responses, model sam-3.1, input_text = plain noun (person, cake, bottle, tube, book, phone, dish), input_image = captured photo as base64 data URL
- Used for: centre guidance, product-in-frame check, SAM Auto Zoom (box width decides 2x / 1.5x / 1x)
- Limits: Finds a person/product, does NOT judge facing, smile, or hair. A box on a turned photo is NOT a failure. A tiny edge fragment (e.g. height 4%) must be called "only partly in frame", not "good".
- Status: Verified from official Meta docs, tested live with HTTP 200, box parsing tested with real boxes

### Muse Spark — Wording skill
- What: Turn SAM box data into plain-language guidance
- How: Muse Spark via Meta Model API, prompted for short, plain, actionable words, not scores
- Used for: "move left a little", "face turned — look at the camera", "smile a bit", "hair falling on face", "product not in frame — bring it closer"
- Limits: Guidance is advice, not a judgment of beauty. Creator is the final judge via guidance ticks.

### Muse Voice Transcribe — Transcript skill (stretch goal)
- What: Transcribe what the creator said, compare to a checklist, answer "What did I forget to say?"
- Status: Stretch goal only. MVP uses browser SpeechRecognition for voice commands and typed checklist ticks. Do not claim Transcribe where browser speech is used.

### Muse Code — Builder skill (assistant only)
- What: Coding assistant used to write and coach the build
- Limits: Muse Code API login is separate. It does NOT supply the browser app's runtime key. Runtime key lives only in the browser key box.

## 3. App skills — what SoloDirectorAI itself can do
- Conversation: turn-taking, slot filling, one utterance can fill mode + occasion + ready, never re-asks a filled slot, reliable Stop once only, Interrupt fallback, reload restore, echo guard, Resume Previous Session
- Camera: opens on "I'm ready", "All good?" gate, session stays ON the whole shoot, Stop also stops camera
- Capture: voice-first hands-free capture, "capture" / "Capture Now", auto-capture ~10 sec in Live Session, group countdown 5-4-3-2-1, fallback Capture button, Enter sends typed answers
- Guidance: manual ticks (face visible, looking, smile, hair, cake), Show guidance, voice guidance for first missing tick, retake loop, Save Best Photo
- SAM: captured-photo-only test, centre + size + edge rules, product-in-frame reminder, SAM Auto Zoom (no manual zoom buttons)
- Live Session: pre-brief, auto-capture, gallery, session status
- Video: record, stop by voice/button, Mark Good / Mark Empty, trim list, Takes Manager, best take only after user approval, never auto-delete
- Voice commands: "guidance", "save best", "capture", "stop", "done", "start" / "resume" within 60 sec after Stop
- Edit: best take + best photo + trim list + user tick "I checked" → Ready to Post: YES, manual post only, no auto-post
- Front end: interactive step-screen UI, hero header, step tracker 1–8, cards, one screen at a time, SAM Auto Zoom status, big readable buttons

## 4. Technical skills used to build it
- HTML / CSS / JavaScript, single-file web app, front-end-only, no Python backend (backend only if CORS forces it)
- Browser APIs: getUserMedia (camera), MediaRecorder (video), SpeechRecognition + speechSynthesis (voice), Canvas (capture), localStorage (key + conversation restore + resume, never in file)
- SAM box parsing: `<|box;x1=...;y1=...;x2=...;y2=...;w=...;h=...|>` → centre %, width %, height %, edge checks
- Digital zoom: CSS scale crop around the subject, capped 2x, not physical movement
- Testing skills used by Muse: JS syntax check (node --check), feature presence search, SAM box parsing with real user boxes, echo / resume / countdown / voice-restart patches

## 5. Skills the creator needs (very few, by design)
- Talk to the app, say mode + occasion + "I'm ready", say "All good"
- Look at guidance ticks, tick what is true, retake if needed
- Say "capture", "stop", "save best", "guidance"
- Type a shape noun for product check (bottle, not brand name)
- Save best before closing the page (no database in MVP, reload loses unsaved takes)
- No photography, editing, coding, or gimbal skill needed — that is the point

## 6. Skills NOT used / NOT claimed
- No multi-agent system — single-agent, multi-model flow only
- No native app, no Play Store build, no cloud database, no auto-posting, no re-encoding of video
- No SAM facing / smile / hair judgment, no perfect continuous tracking, no instant missing-person alert (sampled, a few seconds late)
- No key in code — key handling is a skill in itself: browser key box only, never in file, chat, Discord, screenshot, or git

## 7. Skill checklist for submission
- [x] SAM 3.1 live, box + centre + product check
- [x] Muse Spark plain-word guidance
- [ ] Muse Voice Transcribe — stretch, not MVP (state honestly if asked)
- [x] Voice-first capture, live session, video takes, edit + Ready to Post
- [x] Interactive step-screen front end, SAM Auto Zoom, no manual zoom buttons
- [ ] Demo video (birthday first), rehearsal twice — Nov 3
- [ ] Repo cleaned, no key committed — Nov 3–4
