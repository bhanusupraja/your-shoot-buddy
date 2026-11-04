# SoloDirectorAI — Full Project Plan

## 1. Goal in one line
A creator moment assistant: a solo creator talks first to the app, then the phone (fixed, no gimbal, no crew) captures photos and video, guides live in plain words, and keeps only the best moments. Product framing: **"creator moment assistant"**, not just "coach" or "photo scorer".

## 2. Models and architecture
- Models: SAM 3.1 (sees), Muse Spark (words guidance), Muse Voice Transcribe = stretch goal only
- Architecture: **single-agent, multi-model** — one director decision flow, NOT multi-agent
- Meta hosted API only

## 3. How it works, live session
1. Talk first: App greets, asks photos or videos, asks occasion in her own words, waits for "I'm ready"
2. Camera opens, "All good?" — Yes → Session ON, conversation stays listening the whole session
3. Capture: voice "capture" / "Capture Now" / auto-capture ~10 sec in Live Session, or group countdown
4. Guide live: not centred, face not in middle, face turned, smile, hair, subject too small/large, important item not visible
5. Retake, Save Best, Video Takes, Edit, Ready to Post — user posts manually, app never auto-posts, never auto-deletes

## 4. Features — status
- [x] **Feature 1 — Conversation:** turn-taking, slot filling (mode + occasion + ready in one go), reliable Stop once only, Interrupt fallback, reload restore, echo guard
- [x] **Feature 2 — Camera open on ready + All good:** voice-first hands-free capture (Pathway 1), button fallback, Stop also stops camera, Enter sends typed answers, Resume Previous Session (no repeat conversation)
- [x] **Feature 3 — Photo capture + guidance + voice guidance:** guidance ticks (face visible, looking, smile, hair, cake), Show guidance, Save Best Photo, Group Countdown 5-4-3-2-1, voice "guidance" / "save best", countdown cleared on Stop
- [x] **Feature 4 — SAM box + center guidance + product in frame:** SAM only (countdown removed from Feature 4), key only in browser key box, never in file/chat. SAM tests the **captured photo only**, not live re-capture. Center + size + edge rules (see Checks). Product check is **dynamic**: type any shape noun (person, cake, bottle, tube, book, phone, dish, crochet) — NOT fixed to cake/CeraVe, brand names do not work, use bottle/tube for CeraVe
- [x] **Feature 5 — Live Session:** auto-capture ~10 sec, Capture Now, gallery
- [x] **Feature 6 — Video recording + Takes Manager:** record, Mark Good / Mark Empty, trim list, best take only after user approval, never auto-delete
- [x] **Live video frame analysis (during recording, speaks):** pre-brief items first (ingredients, crochet, bottle), then sampled frame check every ~5–10 sec (not every frame), SAM noun check per item, voice speaks if missing: "crochet not visible — bring it into frame", "onion missing from this frame", "good — crochet visible". Sampled, a few seconds late, not instant, not every object in the world — only pre-brief items, one noun at a time
- [x] **Missing detection — photo, video frame, and live frame (all three):** if ANY important item is missing from a photo, a video frame, or a live frame, the app MUST say it is missing, in words and on screen: "MISSING: [item] is missing from this frame / photo. Bring it into frame and capture / record again." No silent failure. Photo: SAM no box after capture → missing message. Video frame: sampled frame no box → voice missing message. Live frame: SAM check on current frame no box → missing message. If item is visible, app says "Good, [item] visible" or stays quiet, never says missing when it is present.
- [x] **Feature 7 — Voice commands + transcript checklist / forgot to say:** voice commands, typed checklist tick, "What did I forget to say?" — transcript is browser SpeechRecognition in MVP, Meta Voice Transcribe is stretch goal
- [x] **Feature 8 — Edit + Save Best + trim list + Ready to Post:** best take + best photo + trim list + user tick "I checked" → Ready to Post: YES
- [x] **SAM Auto Zoom (new, end-to-end):** no manual zoom buttons — SAM box width decides: <30% → 2x, 30–60% → 1.5x, >85% → 1x zoom out
- [x] **Front end — interactive step-screen UI:** hero header, step tracker 1–8, cards, interactive buttons, top "Go to" bar, **one screen at a time** (not all on one long page). CSS/layout only, feature logic unchanged

## 5. Files — one live file
- End-to-end final: `solodirectorai-end-to-end-final.html` — Features 1–8 + front end + SAM Auto Zoom + step-screen
- Feature files (backups / step history): `solodirectorai-feature1-v8-conversation.html`, `solodirectorai-feature2-camera.html`, `solodirectorai-feature3-guidance.html`, `solodirectorai-feature4-sam.html`
- Run: save as `index.html` in her SoloDirectorAI folder, VS Code → Open with Live Server (`127.0.0.1:5500`). Previous file → `backups/`, backups are not run. Muse cannot open her browser tab or camera/mic — she runs it on her laptop.
- Key rule: Meta API key **only** in the page's browser key box (localStorage), never pasted in file, chat, screenshot, or other sharing. Muse Code API login is separate and does not supply the browser key.

## 6. Phases
- Build: Features 1–3 closed, Feature 4 SAM tests
- End-to-end: End-to-end file + front end + SAM Auto Zoom + step-screen
- Demo + polish: Demo video (birthday first), rehearsal twice, front-end polish, re-test all features
- Release: Demo video + write-up, "creator moment assistant" framing

## 7. Demo plan
- First demo: birthday cake-cutting, photo coaching
- Second demo (simple video): crochet / skincare review, product in frame
- Show the full loop, never a one-shot score: pre-brief → live check → guidance → retake → Save Best → simple video trim
- Originality claim: NOT world-first. Claimable originality is the combination + her code + her demo footage. Similar parts already exist (Pixel Camera Coach, etc.).

## 8. Known limits — honest, do not over-claim
- SAM finds a person/product, does NOT judge facing, smile, or hair — those stay manual guidance ticks. A box on a turned photo is NOT a failure.
- Digital zoom is a crop, capped ~2–3x, not physical movement, not smooth continuous tracking.
- Missing-person alert during video is sampled, a few seconds late, not instant.
- Transcript in MVP is browser speech, not Meta Voice Transcribe.
- Video is a trim list only, no browser re-encoding.
- No database for takes in MVP: takes live in-page + as downloads, reload loses unsaved takes — save best before closing.
- Browser speech recognition is unreliable on iPhone Safari — use Chrome/Edge on laptop, type fallback on Safari.

## 9. Checks — tested by Muse (my side)
- [x] JavaScript syntax check (node --check) — pass, end-to-end file, 2 script blocks
- [x] All 8 features present in end-to-end file — found by text search
- [x] SAM box parsing with her 3 real boxes:
  - 58% / width 84% / height 85% → too close / fills frame, not "good"
  - 58% / width 15% / height 4% → only partly in frame, bottom-edge fragment, not "good"
  - 81% / width 37% / height 15% → right side, partly cut off, move left
- [x] Echo guard, resume, countdown-stop, SAM captured-photo-only, voice auto-restart — code patched and syntax-checked
- [x] Front end: step-screen, hero, cards, SAM Auto Zoom status — present, syntax-checked

## 10. Checks — user one-time test only (do NOT re-test per feature)
- [ ] Happy path: Start → photos, selfie, ready → camera → all good → session ON
- [ ] Voice "capture" → photo appears (no typing)
- [ ] Guidance ticks → Show guidance → missing list appears
- [ ] Key box → SAM person → HTTP 200 + box appears
- [ ] Photo WITHOUT you → SAM: no box, or "partly in frame" (not "centered good")
- [ ] SAM Auto Zoom: small box → zoom in, large box → zoom out, no zoom buttons visible
- [ ] Step-screen: top "Go to" bar → only one screen visible at a time
- [ ] Video 10 sec → stop → Takes list → Ready to Post: YES
- [ ] Voice "stop" → conversation + camera off, once only

## 11. Checks — before release
- [ ] Demo video recorded, rehearsed twice
- [ ] Write-up leads with "creator moment assistant", full loop, Meta tooling use, human loop visible (retake, best choice, final approval)
- [ ] Front end re-test after polish (design must not break features)

## 12. Risks
- Voice capture occasionally misses — workaround: wait for app to finish speaking, say clearly, or type "capture" / Fallback Capture button.
- Echo on laptop speakers — workaround: headphones, lower speaker volume, echo guard in code.
- Health / screen time: keep tests to the one-time happy-path list above, rest between tests.
