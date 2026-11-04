# SoloDirectorAI — Checks
## Detailed test cases for every feature, what Muse tested, and what still needs to be tested by you
## Everything very documented — tested vs to-do, for every feature, in one file

### How to read this file
- **Tested by Muse** = I checked this on my side, with evidence (code check, logic check, real data check). You do NOT need to re-check the code part, only the live part if listed under To-do.
- **Needs to be tested by you** = Only you can test this, because it needs YOUR laptop camera, YOUR mic, YOUR key, YOUR voice, YOUR demo photo/video. I cannot open your browser, camera, or mic.
- **Pass if / Fail if** = exactly what should happen, and what counts as a failure.
- **Take care** = the detail that causes most failures if missed.

---

## Feature 1 — Conversation
### Tested by Muse
- [x] JS syntax check (node --check) — pass, conversation script has no syntax error
- [x] Slot filling logic reviewed: one utterance can fill mode + occasion + ready together, filled slots are never re-asked
- [x] Stop logic reviewed: stop cancels speech, aborts recognition, clears timers, sets stopped=true, every next step checks stopped first
- [x] Echo guard logic reviewed + fixed: only LONG (>=20 chars) repeats of app speech are ignored with "Echo ignored" log; short answers ("photos", "all good", "am I in frame") are never echo — verified by VOICE/isEcho selftests, 53/53 green. Mic restart after silence is delayed (Chrome rejects sync restart).
- [x] Occasion question logic reviewed: "what is the occasion" is NOT set as occasion, "I am ready" is NOT set as occasion when occasion is missing

### Needs to be tested by you — detailed test cases
- TC1.1 Start: Press Start Conversation.
  - Steps: Press button, wait, say nothing.
  - Expected: App says "Hi! How can I help you? Do you want to record photos or videos?" and then WAITS.
  - Pass if: App waits. Fail if: App speaks next question without your answer.
  - Take care: Do not speak while app speaks.
- TC1.2 Mode: Say "photos".
  - Expected: "Got it, photos. What is the occasion?"
- TC1.3 Occasion separate: After mode, say "selfie".
  - Expected: "Got it — photos for selfie. Ready?" Occasion must be a separate step.
- TC1.4 One-go: Say "I want a video, my occasion is birthday, I am ready" in one sentence.
  - Expected: Mode + occasion + ready all filled, NO re-ask of mode or occasion.
- TC1.5 Both: Say "I want both".
  - Expected: Photos and video, NOT repeat of photos-or-videos question.
- TC1.6 Negation: Say "I want a video not a selfie".
  - Expected: Video, occasion NOT selfie.
- TC1.7 Any occasion: Say "maternity shoot" / "LinkedIn headshot" / "vision board" / "about myself".
  - Expected: App accepts any occasion in your words, does NOT loop.
- TC1.8 Occasion question echo: Say "what is the occasion".
  - Expected: App does NOT set occasion to that phrase. It re-asks in your own words.
- TC1.9 Ready without occasion: Say "I am ready" when occasion is missing.
  - Expected: "Ready? Occasion first. What is the occasion?" — NOT "photos for I am ready".
- TC1.10 Name: Say "Hi, can I call you Gemini?"
  - Expected: App says call it Chitti, your cameraman friend, not Gemini, then continues.
- TC1.11 Stop once: Say "stop the conversation" / "stop".
  - Expected: Stops once only, no repeat, no next voice, camera stops too.
- TC1.12 Interrupt: Tap Interrupt while app speaks.
  - Expected: App stops speaking, session stays ON. Interrupt ≠ Stop.
- TC1.13 Reload: Reload page, press Continue Previous Conversation.
  - Expected: Log + mode + occasion restore, NOT reset.
- TC1.14 Silence: Say nothing for 10 seconds after app question.
  - Expected: App WAITS, does NOT repeat on its own.
- TC1.15 Mic denied: Deny mic permission.
  - Expected: Type fallback appears, you can type answers. Fail if: app crashes or loops.
- TC1.16 Echo wait: Say nothing, wait 10 sec after app speaks.
  - Expected: App does NOT take its own voice as your answer. Log may show "Echo ignored", or app simply waits.

## Feature 2 — Camera + Session ON
### Tested by Muse
- [x] JS syntax check — pass
- [x] Camera open logic reviewed: "I'm ready" → camera open → "All good?" → session ON
- [x] Stop logic reviewed: Stop also stops camera tracks, sets video srcObject = null, sessionOn = false
- [x] Enter sends logic reviewed: typeBox keydown Enter → sendBtn.click(), Send button still works
- [x] Resume logic reviewed: mode + occasion saved on session ON, resume restores them, direct to camera, no repeat Hi/mode/occasion
- [x] Wake listener logic reviewed: after ANY stop (voice/typed/button), 60 sec wake listener for "start" / "resume", typed "start" also resumes if resume data exists

### Needs to be tested by you
- TC2.1 Ready opens camera: Mode + occasion + "I'm ready".
  - Expected: Camera opens, "Camera open. All good?"
- TC2.2 All good: Say "yes" / "all good".
  - Expected: "Session is ON. I will stay listening the whole session."
- TC2.3 Capture by voice: Say "capture".
  - Expected: Photo in Captured photo area, "Captured. Session is still ON."
- TC2.4 Capture twice: Say "capture", wait for app to finish, say "capture" again.
  - Expected: Second photo also appears, session still ON. Take care: wait for speech to finish before second capture.
- TC2.5 Capture in All-good stage: At "All good?" stage, say "Capture Me" without Yes.
  - Expected: Session turns ON and captures. Fail if: capture ignored here.
- TC2.6 Short speech: App messages short/fast, not long/slow.
  - Expected: "Camera open. All good?" / "Captured. Session on."
- TC2.7 Enter sends: Type, press Enter, do NOT click Send. Expected: Sends.
- TC2.8 Button sends: Type, click Send. Expected: Sends.
- TC2.9 Camera stop: Session → "Stop".
  - Expected: Conversation off AND camera light off AND video blank.
- TC2.10 Camera fail: Deny camera permission, press Fallback: Start Camera Manually.
  - Expected: Manual tap opens camera, or exact permission error shown. Take care: app cannot open browser Settings automatically — use lock icon → Site settings → Camera = Allow.
- TC2.11 Resume: Stop → within 60 sec say "start" / "resume", or press Resume Previous Session.
  - Expected: Same mode + occasion, direct to camera, NO repeat Hi/mode/occasion. Fresh Start Conversation only if you press Start Conversation itself.
- TC2.12 Video word in photo session: Say "record me i want a video" in a photo session.
  - Expected: App says video is not in Feature 2, say capture for a photo. NOT silent photo capture as if video were happening. Video is Feature 6 only.

## Feature 3 — Photo Guidance
### Tested by Muse
- [x] JS syntax check — pass
- [x] Guidance logic reviewed: ticked = good, unticked = missing, only missing listed, all ticks = "All ticks are good. Save as best."
- [x] Voice guidance logic reviewed: "guidance" in session → first missing tick spoken, then listening restarts (speakAndListen)
- [x] Countdown timer logic reviewed: countdown timers are tracked in timers list, cleared on Stop, stopped check before final capture
- [x] Save Best logic reviewed: downloads captured photo as best, no auto-delete

### Needs to be tested by you
- TC3.1 Guidance missing: Capture, tick NO boxes, Show guidance. Expected: All 5 missing listed.
- TC3.2 Guidance some: Tick 2 boxes, Show guidance. Expected: Only 3 unticked listed, ticked NOT listed.
- TC3.3 Guidance all: Tick all 5, Show guidance. Expected: "All ticks are good. Save as best."
- TC3.4 Voice guidance: In session, say "guidance". Expected: First missing tick spoken.
- TC3.5 Save Best button: Press Save Best Photo. Expected: Best photo downloads.
- TC3.6 Save Best voice: In session, say "save best". Expected: Best downloads, no button needed.
- TC3.7 Group Countdown: Press Group Countdown. Expected: "Look this side" + 5-4-3-2-1 voice + auto capture, one photo.
- TC3.8 Countdown + Stop: Press Countdown, then immediately Stop. Expected: After 5 sec, NO photo. Fail if: photo still taken after Stop.
- TC3.9 Voice after guidance: Press Show guidance, wait for voice to finish, say "next capture". Expected: Next photo by voice, no manual button. Fail if: listening died after guidance.
- TC3.10 Tick meanings, take care:
  - Face fully visible = head/chin/side NOT cut off
  - Looking = face to camera, NOT profile / turned away
  - Smile a bit = expression a little, NOT serious only
  - Hair neat = hair NOT falling on face
  - Cake fully visible = only if cake occasion, otherwise ignore

## Feature 4 — SAM + Product in Frame
### Tested by Muse
- [x] JS syntax check — pass
- [x] SAM box parsing tested with YOUR 3 real boxes:
  - Box 102,73,639,479 → centre 58%, width 84%, height 85% → too close / fills frame, NOT "good"
  - Box 326,458,419,479 → centre 58%, width 15%, height 4% → only partly in frame, bottom-edge fragment, NOT "good"
  - Box 404,406,639,479 → centre 81%, width 37%, height 15% → right side, partly cut off, move left
- [x] SAM captured-photo-only logic reviewed: callSam uses camPhoto.src, does NOT call voiceCapture() to re-capture live frame. If no captured photo, error: "Capture a photo first, then SAM."
- [x] Centre/size/edge rules reviewed: centre 40–60% = good only if height >20% and width >=15% and not bottom-edge fragment; otherwise partly / too close / move left/right
- [x] Product dynamic noun logic reviewed: Important item text box, any shape noun, brand names do NOT work, use bottle/tube for CeraVe
- [x] Voice after SAM logic reviewed: restartListeningAfterSam() called on SAM success and failure, rec.onend restarts if session ON

### Needs to be tested by you
- TC4.1 Key save: Paste key in key box, Save. Expected: "Key saved in this browser only." Take care: key must NOT appear in file, chat, or screenshot. Clear key before sharing screenshots.
- TC4.2 SAM person: Capture WITH you, item = "person", Check with SAM. Expected: HTTP 200, box + centre % + width % + height %.
- TC4.3 Centre good: Person centred 40–60%, width 25–60%, height >20%. Expected: "Subject centered — good."
- TC4.4 Centre left/right: Person <40% / >60%. Expected: "Move right a little" / "Move left a little".
- TC4.5 Photo WITHOUT you: Capture empty wall, Check SAM person. Expected: No box, or "only partly in frame" — NOT "centered good". Take care: SAM may return a tiny fragment for wall/pillow — size/edge rules must catch it.
- TC4.6 Small / edge fragment: Photo with only top of head at bottom edge. Expected: "Person only PARTLY in frame — NOT good, even if centre is 58%." Fail if: app says "centered good".
- TC4.7 Turned photo: Face profile / turned left, Check SAM. Expected: Box still appears. This is NOT a failure. Guidance ticks must flag "face turned".
- TC4.8 Cut-off photo: Face cut off at side/bottom, Check SAM. Expected: Box at edge, advice says partly cut off / move into frame.
- TC4.9 SAM uses captured photo only: Capture photo A, move away, press Check SAM. Expected: Result for photo A, NOT for new live frame. Fail if: result changes because you moved after capture.
- TC4.10 Product in frame: Item = "bottle", bottle in frame, Check Product. Expected: "Good, product in frame."
- TC4.11 Product missing: Bottle NOT in frame, talking about bottle, Check Product. Expected: "Reminder, product is not in frame. Bring it closer."
- TC4.12 Product small: Bottle very small (width <15–20%). Expected: "Bring closer / zoom in."
- TC4.13 Dynamic noun: Change item to "book" / "phone" / "dish" / "crochet". Expected: SAM checks that noun, not only cake/CeraVe. Brand "CeraVe" alone must NOT be used — use "bottle" / "tube".
- TC4.14 SAM after voice: After SAM test, say "capture" by voice. Expected: Next capture works, listening did NOT die after SAM.
- TC4.15 SAM after stop: After SAM test, say "stop" by voice. Expected: Stop works, no typing needed.
- TC4.16 Key clear: Press Clear saved key. Expected: "Saved key cleared." Next SAM says "No key in key box."

## Feature 5 — Live Session
### Tested by Muse
- [x] JS syntax check (end-to-end file) — pass
- [x] Live session logic reviewed: auto-capture timer, Capture Now, gallery list, session status
- [x] SAM Auto Zoom logic reviewed: box width <30% → 2x, 30–60% → 1.5x, >85% → 1x, status label shown, manual zoom buttons hidden

### Needs to be tested by you
- TC5.1 Start Live Session: Pre-brief (birthday, capture photos), Start Live Session. Expected: Session starts, status shows pre-brief.
- TC5.2 Auto-capture 10 sec: Wait ~10 sec, then ~20 sec. Expected: Photo auto-captures about every 10 sec, gallery grows, no "capture" command needed.
- TC5.3 Capture Now: Press / say "Capture Now" in Live Session. Expected: Immediate photo, in addition to auto-capture.
- TC5.4 Gallery: After 3 auto-captures + 1 Capture Now. Expected: Gallery shows 4 photos, in order.
- TC5.5 SAM Auto Zoom in Live Session: Small box → 2x, medium → 1.5x, large → 1x, status label visible, NO manual zoom buttons visible.
- TC5.6 Stop Live Session: Say "stop". Expected: Auto-capture stops, total count + gallery remain, camera stops.

## Feature 6 — Video Recording + Takes + Video Frame Analysis
### Tested by Muse
- [x] JS syntax check (end-to-end file) — pass
- [x] Video logic reviewed: MediaRecorder, Mark Good / Mark Empty, trim list, Takes list, best take only after approval, never auto-delete
- [x] Video frame analysis logic documented and reviewed: pre-brief first, sampled frame check every ~5–10 sec, one noun at a time, voice if missing, quiet if visible, sampled + a few seconds late (NOT instant, NOT every frame)

### Needs to be tested by you
- TC6.1 Record video: Say "record" / press Start Video, record 10 sec. Expected: Video records, status shows recording.
- TC6.2 Stop video: Say "stop recording" / press Stop Video. Expected: Video stops, video file / download available.
- TC6.3 Mark Good: Mark Good during / after video. Expected: Trim list shows GOOD at that second.
- TC6.4 Mark Empty: Mark Empty for a segment with nothing important. Expected: Trim list shows EMPTY — cut at that second.
- TC6.5 Takes: Record Take 1, Take 2, Take 3. Expected: Takes list shows 3 takes, in order.
- TC6.6 Best take: Keep Best Take Only. Expected: Best score take downloads, other takes NOT auto-deleted. Deletion only after your approval.
- TC6.7 Video frame analysis — ingredients: Pre-brief ingredients (tomato, onion, salt). While cooking, sample frame.
  - Expected if missing: Voice "Onion is missing from this frame." / "Tomato is missing."
  - Expected if visible: Quiet, or "Good, onion visible."
  - Take care: Sampled 5–10 sec, a few seconds late, NOT instant, NOT every frame, one noun at a time.
- TC6.8 Video frame analysis — crochet: Pre-brief "crochet top". While talking, sample frame.
  - Expected if crochet NOT visible: Voice "Crochet is not visible — bring it into frame." + SAM Auto Zoom in 2x to crochet only.
  - Expected if crochet visible: Quiet / "Good, crochet visible." Then zoom out while you talk.
- TC6.9 Video frame analysis — bottle: Pre-brief "CeraVe bottle". While reviewing, sample frame.
  - Expected if bottle NOT in frame: Voice "Bottle is not in frame — bring it closer."
  - Expected if bottle in frame: "Good, product in frame."
- TC6.10 Missing person in video: Dance / move out of frame while recording.
  - Expected: Sampled warning "You are not in this, come into the frame." (late, NOT instant).
- TC6.11 Video in photo session: See TC2.12 — video must NOT silently happen in a photo session.

## Feature 7 — Voice Commands + Transcript Checklist
### Tested by Muse
- [x] JS syntax check — pass
- [x] Voice command logic reviewed: "guidance", "save best", "capture", "stop", "done", "start"/"resume", "Chitti, take my photo"
- [x] Transcript limit reviewed: MVP uses browser SpeechRecognition, Meta Voice Transcribe is stretch goal — do NOT claim Transcribe as done in MVP

### Needs to be tested by you
- TC7.1 Voice "guidance": In session, say "guidance". Expected: Guidance voice plays.
- TC7.2 Voice "save best": In session, say "save best". Expected: Best downloads.
- TC7.3 Voice "Chitti, take my photo": Say wake phrase + capture. Expected: Photo captures.
- TC7.4 Transcript checklist: Type ingredients / steps first, then speak them. Expected: Checklist ticks as you say them.
- TC7.5 Forgot to say: After speaking, ask "What did I forget to say?" Expected: List shows ONLY items you did NOT say.
- TC7.6 Transcript limit, take care: If app uses browser speech, do NOT write "Meta Voice Transcribe" in demo as if it were used. State browser speech honestly, Transcribe as stretch.

## Feature 8 — Edit + Save Best + Ready to Post
### Tested by Muse
- [x] JS syntax check — pass
- [x] Edit logic reviewed: best take + best photo + trim list together, user tick "I checked" → Ready to Post: YES, no auto-post code path

### Needs to be tested by you
- TC8.1 Edit output: Press Create Edit / Edit. Expected: Output shows best take + best photo + trim list together.
- TC8.2 I checked tick: Tick "I checked". Expected: "Ready to Post: YES" appears.
- TC8.3 No auto-post: After Ready to Post: YES. Expected: NOTHING is posted automatically. You post manually.
- TC8.4 No auto-delete: After Edit. Expected: No take / photo is deleted without your approval.

## Feature 9 — Front End (Interactive, Step-Screen)
### Tested by Muse
- [x] JS syntax check — pass, 2 script blocks in end-to-end file
- [x] Step-screen logic reviewed: top "Go to" bar, one section open at a time, heading click opens that section, others close, hero + step tracker present
- [x] SAM Auto Zoom status present, manual zoom buttons hidden (display:none)

### Needs to be tested by you
- TC9.1 Step-screen open: Open end-to-end file. Expected: Top "Go to" bar visible, only ONE screen visible at a time, other sections hidden.
- TC9.2 Go to bar: Press a step button (e.g. SAM). Expected: Only SAM screen opens, others close, page scrolls to top.
- TC9.3 Heading click: Click a section heading. Expected: That section opens, others close.
- TC9.4 Hero + steps: Header, step tracker 1–8, cards visible. Expected: Modern website look, neat spacing, big readable buttons.
- TC9.5 Button interaction: Hover / press a button. Expected: Button lifts / scales slightly, no feature breaks.
- TC9.6 Front end must NOT break features: After front-end change, re-run Happy Path (Section K). Expected: All happy-path steps still pass.

## Feature 10 — Missing Detection (Photo, Video, Live — all three)
### Tested by Muse
- [x] JS syntax check — pass, "MISSING:" branch present in end-to-end file SAM observer
- [x] Missing logic reviewed: SAM observer, if SAM output updated but NO box found, sets guidance + session status to "MISSING: [item] is missing from this frame / photo."
- [x] Missing rule reviewed: No box OR tiny edge fragment = missing / partly, never "centered good" for missing

### Needs to be tested by you
- TC10.1 Photo missing: Capture photo WITHOUT person/item, SAM person/item. Expected: "MISSING: [item] is missing from this photo. Bring it into frame and capture again."
- TC10.2 Video frame missing: Sampled video frame WITHOUT pre-brief item (e.g. crochet out, onion out). Expected: Voice "MISSING: [item] is missing from this frame."
- TC10.3 Live frame missing: Current frame check WITHOUT item. Expected: "MISSING: [item] is missing from this frame."
- TC10.4 Visible, NOT missing: Item in frame, box reasonable size. Expected: "Good, [item] visible" or quiet. Fail if: app says missing when item IS present.
- TC10.5 Missing examples, each must be spoken/shown, not silent:
  - Person missing → "Person is missing from this frame."
  - Cake missing → "Cake is missing."
  - Bottle missing → "Bottle is missing — bring it closer."
  - Tomato missing → "Tomato is missing from this frame."
  - Crochet missing → "Crochet is missing — bring it back into frame."
- TC10.6 Missing applies to every pre-brief item, not only person, not only cake/CeraVe.
- TC10.7 Live Q&A: In session with camera + key, ask "am I in frame?" Expected: App samples the live frame, speaks "Yes… in frame…" or "No… not in frame…", shows the answer under Step 5 Live frame answer.
- TC10.8 Live Q&A item: Ask "is the cake visible?" / "is the bottle visible?" Expected: Answer names that item, not person.
- TC10.9 Live Q&A honest limits: Ask "am I smiling?" / "is my hair neat?" Expected: App says it cannot judge that yet and points to guidance ticks — never a guessed yes.

## K. Happy Path — do this once, if you have little time / screen time
1. Start → photos, selfie, ready → camera → all good → session ON
2. Voice "capture" → photo appears
3. Guidance ticks → Show guidance → missing list appears
4. Key box → SAM person → HTTP 200 + box appears
5. Photo WITHOUT you → SAM: no box / partly in frame
6. SAM Auto Zoom: small box → zoom in, large box → zoom out, no zoom buttons
7. Step-screen: Go to bar → one screen at a time
8. Video 10 sec → stop → Takes list → Ready to Post: YES
9. Voice "stop" → conversation + camera off, once only
If all 9 pass, end-to-end is done. If one fails, send only that test number + screenshot / log.

## L. What needs to be done — summary, by owner
### Done by Muse (do NOT redo)
- [x] All feature code, end-to-end file, front end, SAM Auto Zoom, step-screen, missing detection code
- [x] JS syntax checks, SAM box parsing with your real boxes, logic reviews for echo, resume, countdown, voice restart, SAM captured-photo-only
- [x] Plan, skills, problem statements, instructions, architecture, goals, detailed test cases, this checks file

### Still needs to be done by you (only you can do these)
- [ ] Happy Path (Section K) — once, with YOUR camera, mic, key, voice
- [ ] SAM live test with YOUR key — HTTP 200 with your key, your photos (with / without you, turned, cut-off, bottle, crochet, ingredients)
- [ ] Demo video — birthday first (photo), crochet / skincare second (video), rehearsed twice, full loop shown
- [ ] Front-end look check — step-screen, hero, cards, buttons, on YOUR screen
- [ ] Key safety check — clear saved key before sharing any screenshot, key never in file / chat / sharing
- [ ] Save Best before closing — best photo + best take downloaded, before reload / close

### Still needs to be done together (Muse + you, after your test results)
- [ ] Fix any Happy Path failure you report (send test number + screenshot / log only, not all tests again)
- [ ] Front-end polish re-test after any UI change (design must NOT break features)
- [ ] Final write-up / demo check — "creator moment assistant", full loop, human loop visible, honest limits stated

## M. Things to take care of — every test, every feature
- [ ] Chrome/Edge on laptop, type fallback on Safari, headphones if echo, wait for app to finish speaking before you speak
- [ ] Camera + mic Allow, close other camera apps, Live Server (not Play button), index.html is the live file, backups are NOT run
- [ ] Key only in browser key box, never in file / chat / screenshot / sharing, clear before sharing
- [ ] Save Best before closing — reload loses unsaved takes/photos in MVP (no database)
- [ ] SAM: captured photo only, NOT live re-capture; small/edge box ≠ good; turned box ≠ failure; brand ≠ noun (use bottle/tube, not "CeraVe")
- [ ] Video frame analysis: pre-brief first, sampled 5–10 sec, speaks if missing, quiet if visible, late NOT instant, one noun at a time, only pre-brief items
- [ ] Missing: photo / video / live, all three, must be spoken/shown, never silent, never "good" when missing
- [ ] No auto-post, no auto-delete, best only after your approval, Ready to Post: YES only after "I checked" tick
- [ ] One screen at a time for demo, rest between tests, happy path once is enough if you are unwell
