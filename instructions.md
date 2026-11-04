# SoloDirectorAI — Instructions
## Everything, in detail: milestones you need, and how to do this project, step by step

Read this top to bottom once, then follow one milestone at a time. Do not jump ahead, do not test everything at once. If you are unwell or your eyes hurt, do only the happy-path test in Milestone 9, then rest.

---

## 0. What you are building, in one paragraph
SoloDirectorAI is a creator moment assistant. A solo creator talks first to the app, then a fixed phone captures photos and video, guides live in plain words, and keeps only the best moments. No cameraman, no crew, no gimbal. Photo first, video second, in one web app, front-end only.

## 1. What you need before you start
- A laptop with Chrome or Edge (best for voice). iPhone Safari voice is unreliable — use type fallback there.
- VS Code installed, with Live Server extension.
- A phone or laptop camera + microphone, allowed in the browser.
- A Meta Model API key. You get it from your Meta dashboard. It is shown fully only once — save it safely, do not share it.
- Headphones (helpful if echo happens — app hears its own voice from laptop speakers).
- No GPU needed. Your machine is CPU-only, and this project is designed for that. No Python backend needed, unless a CORS block forces it later.
- No purchases needed. Do not buy anything for this project.

## 2. Folder structure — one live folder only
On your laptop, make ONE folder, for example:
```
SoloDirectorAI/
  index.html          <-- ONLY this file is run. This is the live file.
  backups/
    index-old-1.html
    index-old-2.html
  photos/
    best-photo.jpg    <-- downloads go here, if you move them
  videos/
    best-take.mp4
```
Rules:
- Always save the newest file as `index.html` in `SoloDirectorAI/`.
- Before replacing `index.html`, move the old `index.html` into `backups/`.
- Never run a file from `backups/`. Backups are history, not the live app.
- All other files Muse sends you (feature files, plan, problem statement, test cases) are documents / history, not to be run, unless the message says "this is the live file".

## 3. How to run the app — every time, same steps
1. Open VS Code.
2. Open the `SoloDirectorAI` folder.
3. Right-click `index.html` → **Open with Live Server**. Do NOT use the Play button in VS Code — Play = Run, not Live Server.
4. Browser opens at `127.0.0.1:5500` (or `localhost:5500`). That is correct.
5. Allow Camera and Microphone when the browser asks. If you denied earlier: click the lock icon in the address bar → Site settings → Camera = Allow, Microphone = Allow, then reload.
6. Close other apps using the camera (Zoom, Teams, another camera tab).
7. You are ready. Follow the app's voice: Start Conversation → mode → occasion → "I'm ready" → camera → "All good?" → Session ON.

## 4. How to use the key — safety, read this twice
- Paste your Meta API key ONLY in the page's browser key box, then press Save key in this browser.
- The key is stored in browser localStorage, NOT in the file.
- Never paste the key in chat, in a file, in a screenshot, or in any sharing. If a screenshot shows the key box, make sure the key is hidden (password dots) or cleared first.
- To clear: press Clear saved key in the app.
- Muse Code API login is separate. It does NOT give the browser app its key, and the browser key does NOT give a coding login. Say them separately if you are confused — they are two different logins.

## 5. Milestones — what you need, in order

### Milestone 0 — Setup (do once)
- [ ] Folder made, VS Code + Live Server ready
- [ ] Camera + mic allowed, headphones ready if needed
- [ ] End-to-end file saved as `index.html`, opened with Live Server, page loads, no blank screen
- Done when: You see the hero header, step tracker 1–8, and Start Conversation button.

### Milestone 1 — Conversation
Goal: App talks like a friend, waits for you, never rushes.
- [ ] Start → "Hi! How can I help you? Do you want to record photos or videos?" → app WAITS
- [ ] Say mode (photos / video / both), then occasion in your own words (selfie, birthday, dish, skincare review, vlog, LinkedIn headshot)
- [ ] Say mode + occasion + ready in one sentence → app must NOT re-ask filled slots
- [ ] Say "stop" → app stops once only, camera stops too
- [ ] Say "what is the occasion" (repeating app's question) → app must NOT set that as your occasion
- Done when: No loop, no repeat question, stop works once.

### Milestone 2 — Camera + Session ON
Goal: Ready opens camera, All good turns session ON, session stays listening.
- [ ] "I'm ready" → camera opens → "Camera open. All good?"
- [ ] "Yes / All good" → "Session is ON. I will stay listening the whole session."
- [ ] Voice "capture" → photo appears, session still ON
- [ ] Voice "capture" again → second photo, session still ON (wait for app to finish speaking before second capture)
- [ ] Typed answer + Enter → sends, without clicking Send (button must also still work)
- [ ] Stop → conversation off + camera light off + video blank
- [ ] Resume: Stop → within 60 sec say "start" / "resume", or press Resume Previous Session → same mode + occasion, direct to camera, NO repeat Hi / mode / occasion
- Done when: Voice capture + voice stop work, resume works, no typing needed for capture/stop.

### Milestone 3 — Photo Guidance
Goal: You are the judge, app guides you to retake until best.
- [ ] Capture photo, tick what is true: face visible, looking, smile, hair neat, cake visible (if cake)
- [ ] Unticked points only appear in guidance, ticked points do NOT appear
- [ ] All ticks → "All ticks are good. Save as best."
- [ ] Voice "guidance" → first missing tick spoken
- [ ] Voice / button "save best" → best photo downloads
- [ ] Group Countdown: "Look this side" + 5-4-3-2-1 + auto capture, one photo
- [ ] Countdown + Stop: countdown timers clear on Stop, NO photo after Stop
- Done when: Guidance list matches your ticks exactly, Save Best downloads.

### Milestone 4 — SAM + Product in Frame
Goal: SAM sees, app tells centre, size, and if the item is missing.
- [ ] Key box: paste key, Save → "saved in this browser only"
- [ ] Capture photo WITH you, Important item = "person", Check with SAM → HTTP 200 + box + centre % + width % + height %
- [ ] Centre: 40–60% = good, <40% = move right, >60% = move left
- [ ] Photo WITHOUT you, empty wall → SAM: no box, or "only partly in frame" — NOT "centered good"
- [ ] Small / edge fragment (e.g. box height ~4% at bottom edge) → "Person only PARTLY in frame — NOT good, even if centre is 58%"
- [ ] Turned photo → box still appears (SAM found a person). This is NOT a failure. Guidance ticks flag "face turned".
- [ ] SAM uses captured photo ONLY, not live re-capture: capture photo A, move away, press SAM → result must be for photo A, not for the new live frame
- [ ] Product: Important item = "bottle" (not brand "CeraVe"), bottle in frame → "Good, product in frame"; bottle NOT in frame → "Reminder, product is not in frame. Bring it closer."
- [ ] Dynamic noun: change item to book / phone / dish / crochet → SAM checks that noun, not only cake/CeraVe
- [ ] After SAM, voice "capture" and voice "stop" still work (listening must NOT die after SAM)
- Done when: With-you = box, without-you = no box / partly, missing = spoken, SAM = captured photo only.

### Milestone 5 — Live Session + SAM Auto Zoom + Missing Detection
Goal: Session runs itself, zoom is automatic, missing is spoken.
- [ ] Pre-brief: tell app what you are making (birthday, crochet top, ingredients list)
- [ ] Start Live Session → auto-capture about every 10 sec, gallery grows
- [ ] "Capture Now" → immediate photo, in addition to auto-capture
- [ ] SAM Auto Zoom: NO manual zoom buttons visible. Small box (<30%) → 2x, medium (30–60%) → 1.5x, large (>85%) → 1x zoom out, with status label
- [ ] Missing detection — photo, video frame, live frame, ALL THREE:
  - Photo missing → "MISSING: [item] is missing from this photo. Bring it into frame and capture again."
  - Video frame missing → voice: "MISSING: [item] is missing from this frame."
  - Live frame missing → "MISSING: [item] is missing from this frame."
  - If visible → "Good, [item] visible" or quiet, never "missing" when present
- [ ] Stop Live Session → auto-capture stops, gallery + count remain, camera stops
- Done when: Auto-capture works, zoom changes by SAM box size, missing is spoken for all three cases.

### Milestone 6 — Video Recording + Takes + Video Frame Analysis
Goal: Record, mark, keep best take, and hear if an item disappears during recording.
- [ ] Record video 10 sec → stop by voice "stop recording" or button → video available
- [ ] Mark Good / Mark Empty during / after video → trim list shows GOOD / EMPTY at that second
- [ ] Record Take 1, 2, 3 → Takes list shows 3 takes
- [ ] Keep Best Take Only → best take downloads, other takes NOT auto-deleted
- [ ] Video frame analysis, detailed:
  - Pre-brief first: ingredients (tomato, onion, salt) OR crochet top OR bottle
  - Sample every ~5–10 sec (NOT every frame, NOT instant — a few seconds late, honestly)
  - Sample frame SAM check, one noun at a time: box = visible, no box = missing
  - If missing, app speaks: "Crochet is not visible — bring it into frame." / "Onion is missing from this frame." / "Bottle is not in frame — bring it closer."
  - If visible, app stays quiet or says "Good, crochet visible."
  - Crochet example: you visible + crochet not visible → speak + zoom in 2x to crochet only → crochet visible → quiet → crochet out again → speak + zoom out while you talk
  - Dance example: you out of frame while dancing → sampled warning "You are not in this, come into the frame."
- Done when: Video records, trim list works, best take only after approval, missing during video is spoken.

### Milestone 7 — Voice Commands + Transcript Checklist
Goal: Hands-free control, and know what you forgot to say.
- [ ] Voice "guidance", "save best", "capture", "stop", "done", "Chitti, take my photo" — all work by voice
- [ ] Type checklist first (ingredients / steps), then speak them → checklist ticks as you say them
- [ ] Ask "What did I forget to say?" → list shows ONLY items you did NOT say
- [ ] Limit, honestly: MVP transcript is browser SpeechRecognition, NOT Meta Voice Transcribe. Transcribe is stretch goal.
- Done when: Checklist + forgot-to-say works, voice commands work without typing.

### Milestone 8 — Edit + Ready to Post
Goal: One edit output, ready to post, manual post only.
- [ ] Create Edit → output shows best take + best photo + trim list together
- [ ] Tick "I checked" → "Ready to Post: YES"
- [ ] After Ready to Post: YES, NOTHING is posted automatically. You post manually.
- [ ] No take / photo is deleted without your approval, ever.
- Done when: Edit output is complete, Ready to Post: YES appears only after your tick.

### Milestone 9 — Front End (interactive, step-screen)
Goal: Looks like a modern website, one screen at a time, not all stacked.
- [ ] Open end-to-end file → hero header, step tracker 1–8, cards visible
- [ ] Top "Go to" bar visible, sticky
- [ ] Only ONE screen visible at a time, other sections hidden
- [ ] Press a step button → only that screen opens, others close, page scrolls to top
- [ ] Click a heading → that section opens, others close
- [ ] Buttons hover / press → lift / scale slightly, no feature breaks
- [ ] After front-end change, re-run Milestone 9 happy path below — front end must NOT break features
- Done when: Demo looks clean, one screen at a time, all features still work after UI change.

### Milestone 10 — Demo + Release
Goal: Show it, not just tell it.
- [ ] Demo 1 (photo, first): birthday cake-cutting — pre-brief → live check → guidance → retake → Save Best
- [ ] Demo 2 (video, simple): crochet OR skincare review — product in frame, video frame analysis, best take
- [ ] Rehearse the demo twice, full loop, not a one-shot score
- [ ] Write-up: start with "creator moment assistant", show full loop, Meta tooling use, human loop visible (retake, best choice, final approval)
- [ ] Final check: key cleared from screenshots / sharing, best photo + best take saved before closing, front end re-tested
- Done when: Demo video + write-up are ready to share, and you can explain the project in 2 minutes: problem → solution → live loop → best output.

## 6. Happy path — if you have little time or screen time, do ONLY this
1. Start → photos, selfie, ready → camera → all good → session ON
2. Voice "capture" → photo appears
3. Guidance ticks → Show guidance → missing list appears
4. Key box → SAM person → HTTP 200 + box appears
5. Photo WITHOUT you → SAM: no box / partly in frame
6. SAM Auto Zoom: small box → zoom in, large box → zoom out, no zoom buttons
7. Step-screen: Go to bar → one screen at a time
8. Video 10 sec → stop → Takes list → Ready to Post: YES
9. Voice "stop" → conversation + camera off, once only
If all 9 pass, the project is done for now. If one fails, send only that step number + screenshot / log.

## 7. Troubleshooting — what to do when it fails
- **Voice capture / stop not working, only typing works:** Listening died after app speech or after SAM. Reload page, press Continue / Resume, wait for app to finish speaking before you speak, use Chrome/Edge, allow mic. If it still fails, send browser name + mic status.
- **Echo loop (app takes its own words):** App hears its own voice from speakers. Use headphones, lower speaker volume, wait for app to finish, then speak. Log should show "Echo ignored" if echo guard works.
- **"What is the occasion" becomes the occasion:** That is a bug, fixed in newer files. Use the newest end-to-end file, and say your occasion in your own words (selfie, birthday), not the app's question.
- **SAM says "centered good" for a tiny fragment:** Check box height / width. Height <20% or width <15% = partly in frame, not good. Use the newest file with size + edge rules.
- **SAM tests live frame, not captured photo:** Use the newest file — SAM must test captured photo only. Capture first, then SAM, do not move after capture before SAM.
- **Camera did not open by voice:** Press Fallback: Start Camera Manually (real tap). If that also fails, lock icon → Site settings → Camera = Allow, close other camera apps, reload.
- **Photo / video disappears after reload:** Expected in MVP — no database. Save Best / download best take before closing or reloading.
- **Zoom buttons visible:** Use the newest end-to-end file — zoom buttons are hidden, SAM Auto Zoom decides.
- **All sections on one long page:** Use the newest end-to-end file — step-screen: Go to bar, one screen at a time.
- **Key in screenshot:** Clear saved key first, or cover the key box, before sharing any screenshot.

## 8. Rules to never break
- Key only in browser key box, never in file, chat, screenshot, or sharing.
- App never auto-posts, never auto-deletes. Best / delete only after your approval.
- SAM does not judge facing, smile, or hair. Those are manual ticks.
- Do not claim world-first, perfect tracking, instant alerts, or Transcribe in MVP. Claim the combination, your code, and your demo footage.
- One live file only (`index.html`), others are backups / documents.
- Rest between tests. Happy path once is enough if you are unwell.

## 9. Documents that go with this project
- `plan.md` — full project plan, features, timeline phases, checks
- `skills.md` — Meta AI skills, app skills, technical skills, creator skills, not-claimed skills
- `solodirectorai-problem-statement.md` — short problem statement
- `solodirectorai-problem-statement-detailed.md` — detailed problem statement, including live video frame analysis and missing detection for photo / video / live frame
- `solodirectorai-detailed-test-cases.md` — very detailed test cases, what to take care of
- `solodirectorai-end-to-end-final.html` — the live app, Features 1–8 + front end + SAM Auto Zoom + step-screen
- This file, `instructions.md` — how to do the project, milestones, troubleshooting
