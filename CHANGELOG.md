# Solo Cameraman — Changelog

Every change requested this session, newest first. Build tags match `APP_BUILD` in `app.js` (shown in the Ready log line).

## 2026-11-04-photogate — Photo capture never fires without the person
- Asked: saying capture with nobody in frame took the photo, then said "person missing" after — warn before, and don't capture.
- Root cause: the gate only covered occasions with a required noun (selfie/birthday/object) and stayed permissive on stale vision — custom/group sessions had no gate at all.
- `agent-core.js`: new `photoCaptureHold` — every photo occasion needs the creator freshly in frame, plus the occasion subject (cake, named object); returns the missing noun, or `'stale'` when vision has no say yet.
- `app.js`: `capturePhoto` holds with the reason spoken BEFORE (nothing captured); stale vision queues one verify-first capture ("Hold on — checking the frame first"), polls immediately, and fires or holds when fresh eyes land; vision failure drops the queue with the reason instead of hanging. Queue cleared on start/stop; burst extras stay silent while queued.
- Note: object sessions now also need you in frame — pure product-only stills are blocked until asked for.
- Tests: `photoCaptureHold` contract (all occasions + stale + subject stacking).

## 2026-11-04-welcome — Skipped-only reminders, bare-word beats, welcome screen
- Asked: mid-take it nags "where is the outro" before the video is finished; add a home/welcome first page.
- Reminder fix: mid-take nag + pause now fire only for beats you jumped over (`getSkipped`), never for unreached trailing beats — the outro can no longer be "forgotten" mid-story. Anything never said is still listed at Stop (unchanged backstop).
- Real bug found by the new tests: saying the literal words "outro"/"highlight" never covered those vlog beats (template keywords shadowed the bare words). Both added; recipe/product/tutorial already match bare words.
- Welcome screen: full-viewport first page (what it does in 3 lines + Start button), same dark panel style, shows in both views; Start reveals the app and focuses Talk. No auto mic/camera requests.
- Docs: `notes.md` reminder line + `WORKFLOW.md` alerts step updated to skipped-only.
- Tests: skipped-vs-unreached reminder contracts, bare-word beat coverage, welcome wiring hooks.

## 2026-11-04-quietmic — Silent resume, no double-speak, echo tails, mic watchdog
- Watched the two new vlogs: clean takes, no zoom moments, pauses cut correctly (the 9s quiet stretch in vlog 1 is the creator silent while rolling — by design only agent/rule time is cut, never creator silence).
- Asked: agent chatter (esp. the resume line) must go; "not listening" when talking.
- Diagnosis: the faster alerts + pause voice + missing voice + resume voice stacked into back-to-back speech, and the mic ignores input while the agent talks — so talking over the chatter felt like deafness. Plus the 3s echo window left long-utterance tails free to land as fake user input.
- `app.js`: resumes are always silent (banner + log confirm); frame alerts (missing-you, framing) stay logged-but-silent while a rule pause already spoke the fix — reminders and topic alerts still speak.
- Echo guard redesigned: suppression now covers the whole utterance (~15 chars/sec + margin, 20s cap) and shrinks to a beat the moment speech actually ends (end event, error, or backstop — single writer). Echo tails can no longer fake commands; replies still land. Trade-off: interrupting mid-sentence no longer registers — talk after it finishes.
- Mic watchdog: recognition sessions churning with zero finals (fast empty ends, audio-capture/network deaths) trip one spoken + logged "I can't hear anything" with the fix; any heard final clears it. Quiet filming never trips it.
- `agent-core.js`: `holdAlertVoice`, `micSessionBarren` (+ tests); echo formula test updated to the cover-whole-utterance contract.
- Zoom tip (no code): say the object's name while it's visible, or hold it near the face — green frame + "Showing X" confirms; quiet 8s or take it away zooms back out. New zoomable words go in `FOCUS_WORDS` (`agent-core.js`).

## 2026-11-04-demoready — Fast leave response, Simple demo view, notes.md
- Asked: walk-outs took ~10s to register; judges need a simple interface; submission needs a notes file.
- Latency diagnosis: 0-4s poll phase + SAM time + 3 same-data gate ticks + 5s alert episode stacked to ~10s, and one slow poll could skip a fixed-interval slot and stretch the effective rate past 8s.
- `agent-core.js`: pause gate default 3→2 ticks (extra same-data ticks never filtered SAM flaps, only delayed); user-missing voice 5s→2s steady (a lone SAM miss can now speak once — rare, and the gate already reacted to single blips); `nextPollDelay` pins the schedule contract.
- `app.js`: self-scheduling SAM polls (launched→4s, skipped→retry in 1s, server cadence still respected); fresh detections run the gate/alerts immediately instead of waiting for the next 1s tick.
- Honest floor: the 4s server cadence (Yash's credit guard) plus model time can't be beaten — typical leave response now ~3-5s, worst ~7s.
- Simple demo view: topbar "Simple view" button + `?view=simple` hides setup/simulator/transcript/log panels; same app underneath, everything still voice-driven. Judges link: `?token=…&view=simple`.
- New `notes.md`: submission story — what it is, Meta-models-only statement, feature list, run + repo map, submission checklist.
- Tests: alert/gate timing contracts updated to 2s/2-tick, `nextPollDelay`, simple-view wiring hooks.

## 2026-11-04-answerlift — Half-out pause, sticky zoom, answers saved (from video + log)
- Watched the uploaded vlog: phone held near the face for a long stretch with no zoom, and the outro spoken during a reminder pause never made the file (it cleared the checklist while paused, so coverage read 4/4 over a file missing the outro).
- Asked: pause when the face is half visible; zoom must stay while the phone is at the face; the outro must be saved.
- `agent-core.js`: `personHalfOut` (one-sided walk-out past the thirds line, or head cut at the top; centered close-ups, bottom touches, and raised arms excluded) → `PERSON_HALF_OUT` issue, blocking via `recordingBlocked({halfOut})`; `stickySubject` keeps the last held object as the SAM query for 20s after the topic goes quiet; `answerLift` rolls again on fresh user speech for reminder latches only (never rule pauses, never during agent speech, never in the echo tail).
- `app.js`: half-out pauses with "step fully into the shot"; every held sighting stamps the sticky subject; STT interim timestamps live user speech and the frame loop lifts reminder pauses silently the moment the creator answers (a spoken resume would re-pause via speech-cut and eat the answer); "zooming back out" log suppressed while holding.
- Zoom is automatic, no toggle: hold near face or name a visible object; green dashed frame + "Showing X — zoomed in" director line confirm it.
- Tests: 5 blocks (half-out predicate + judge + gate, sticky subject, answer lift).

## 2026-11-04-speechcut — Agent-time cut, capture gate, recognition fixes (from live log)
- Verified on the uploaded video: 134s session saved as exactly 59s = wall minus logged pauses minus intro — pause and intro-cut both work; the live view keep-playing was the perception gap.
- Asked: birthday capture must refuse without cake; agent speech time must be cut from the file (not just muted); "I'm back" must unstick; intro replies get eaten; "camera" nags nonsense.
- `agent-core.js`: `photoRequiredNoun` (birthday→cake, selfie→you, object→its subject); topic alerts skip self-referential `camera`/`cam`; echo window 8s→3s (browser AEC + content check cover real bleed; long windows ate prompt replies); `isAgentParrot` catches read-back agent lines.
- `app.js`: capture refused with voice when the required subject is freshly absent (blind/stale vision stays permissive); recorder pauses during agent speech and silently resumes after (rule pauses take ownership cleanly); "I'm back" releases latch, primes the gate, and forces a fresh SAM poll; SAM polls time out at 20s so detections can never freeze forever; parrot lines get "that was my line" instead of confirming occasions; SAM never queried for "camera".
- Tests: 4 blocks (gate nouns, camera exclusion, parrot + guards, echo formula updated with justification).

## 2026-11-04-pauselatch — Visible pause + pause-on-forgot (from live log)
- Asked: pause must LOOK paused; "you forgot X" must auto-pause the video, announce it, and keep agent words out of the file; no stacked recorders.
- `agent-core.js`: `RecordingPause` gains `forcePause`/`releaseLatch` — a reminder pause holds through good frames until said or timed out (tested).
- `app.js`: red PAUSED banner on the live preview (never recorded) + recorder-state in pause/resume log lines + pause()/resume() failure warnings; forgotten-beats reminder speaks "Recording paused — you forgot to say: X", holds up to 30s, lifts early when you say a missing beat; start-while-rolling is refused (dual recorders corrupted files).
- Checked the uploaded `solo-cameraman-vlog (3).webm` (valid VP9+Opus, speech from ~0.6s): file-level pause/mute verdicts need the session log + one timestamp from the user — the new logging makes the next round conclusive.

## 2026-11-04-combined — Real-speech routing (from live log)
- Found: "daily log" / "record myself" / "room tour" fell to empty Custom (with a bogus subject demand); one-breath "looks good, I'm ready" split into a look check + nothing; "I'm ready start recording" stuck; "I'm ready" could become the occasion text; greetings nagged about decor; stale lock survived stop.
- `agent-core.js`: vlog hints += tour/room tour/house tour/home tour, daily/daily log/video log/logging, myself/my face; new `parseLockReady` (lock+ready either order, fillers only — wishes/questions excluded); ready accepts trailing starts.
- `app.js`: combined utterances lock then flow into ready (camera check included); occasion/photo-occasion steps answer "Ready? Occasion first" instead of confirming; greetings skip busy-background; stop resets the lock so every round re-confirms.
- Tests: 3 new blocks (vlog phrasings, lock+ready combos + guards, trailing starts).

## 2026-11-04-unstuck — Check-in deadlock fixes (from live log)
- Found: the new check-in gate deadlocked real speech three ways — mic "looks good" ran a look check instead of locking (handleLine intercepted before setup), "lock it" wasn't an accepted confirmation while the agent says "lock your checklist", and conversational "when you are ready I'm ready" never matched the anchored ready pattern. Reproduced headlessly, then fixed.
- `agent-core.js`: ready pattern accepts conversational leads ("when you are ready…", "so…", "well…") while still rejecting questions about readiness; approval accepts "lock", "lock it", "lock it in", "lock in".
- `app.js`: pre-session approvals route to setup (lock) before the look-check branch; in-session "looks good" still runs a look check.
- Tests: 2 blocks (ready leads + guards, lock verbs + guards); browser repro script re-run green.

## 2026-11-04-checkin — Checklist check-in + review-tracking fixes (from live log)
- Asked: price/design mentions not tracked right; product in camera reported missing; reminders felt unfair; after occasion, ask + confirm the checklist (voice or typed) before anything can start.
- `agent-core.js`: generic `demo`/`subject` beats no longer raise "mentioned but not visible" outside their own template (tutorial/custom still alert via the primary path); checklist coverage is alias-aware ("the bag" / "the product" cover a "handbag" item).
- `app.js`: SAM always asks for a concrete checklist noun as fallback (was person-only until you talked, and abstract topics like "product" never resolved) — fixes "product in camera but reported missing" + the false recording pause; new mandatory check-in — occasion/template changes reset it, "looks good" (voice/chip/typed) locks the list, nothing rolls before that; pre-session "looks good" locks instead of running a look check (as the README always promised).
- Tests: 3 new (demo false-alert gone, tutorial guard kept, alias coverage); one existing episode test re-pointed from generic `demo` to concrete `handbag` (it had pinned the false positive).

## 2026-11-04-photofix — Photo session trust fixes (from live log)
- Asked: Photo button must not assume selfie; "capture me" must always capture; in-frame reporting must be right; stop the "sticking" loop.
- `app.js`: Photo button now asks the occasion (selfie/birthday/group/object) instead of auto-confirming selfie; bare "take photos"/"record a video" in the done step re-asks the occasion instead of sticking; empty checklists say "no checklist this time" instead of "0 of 0 — all covered"; SAM snapshots 480→640px so far/small people stay recognizable.
- Verified the capture regex already has word boundaries (`Captured…` echo can never retrigger) — pinned with a regression test instead of changing it.
- Honest limit left as-is: if SAM sees no person for several polls in a row, the app still reports missing — no code can fix a blind detector; brighter light + stepping closer are the workarounds.

## Installable phone app (no APP_BUILD change — markup/assets only)
- Asked: simple phone app installable on iPhone; Gmail login explicitly deferred (needs owner's Google Client ID; judges use the token link).
- `manifest.json` + iOS tags (`apple-mobile-web-app-capable`, `apple-touch-icon`, theme color): Safari → Add to Home Screen installs fullscreen with the Cameraman icon; no App Store, Apple account, or review needed. Camera/mic work over the HTTPS demo link.
- `icon-180/192/512.png` (emerald camera glyph); `.png` MIME added to the server.
- Tests: new wiring test pins manifest validity + icon files.

## 2026-11-04-demoguard — Demo-link protection (per Meta office hours)
- Asked: implement Yash's checklist — judges link with token, per-IP rate limit, server-enforced 4 s SAM cadence, daily cap with "demo paused".
- `server.js`: `DEMO_TOKEN` gate on `/api/*` (header or `?token=`; unset = open local dev), 120 req/min per IP, 1 SAM call per prompt per 4 s (person+subject pair polls still work), `DAILY_CALL_CAP` upstream calls/day (default 2000) → 429 `demo-paused`. No CORS headers (CORS only stops browsers). Helpers exported + unit-tested.
- `app.js`: token from `?token=` rides on every API call; 401/429 surface once as log + voice + director line ("Demo link needs a valid token", "Demo paused — daily limit reached").
- README: new "Deploy for judging" section (Render/Fly/Railway, demo-only key, token URL format).
- Tests: 4 new proxy helper tests (no-listen, runnable anywhere).

## 2026-11-04-showpause — Pause on broken rules + show-to-face zoom
- Asked: pause the recording while the shot breaks rules (I'm not visible / item not visible / bad light) and resume into the same file when fixed; holding a product to my face should zoom to it, taking it away zooms back out; person compulsory in vlogs, product compulsory in product reviews, situation decides the rest.
- `agent-core.js`: new `presenceNeeded(templateId, …)` (vlog needs you always, product review needs the product always, showing/tour mode never demands you, otherwise self-talk/topic decides); new `recordingBlocked(…)` (pauses on needed-missing, cropped face, dark/washed light; off-center/too-small/busy-background stay spoken hints so the video isn't chopped); new `isHeldNearFace(person, subject)` (product center in the face zone = showing).
- `app.js`: `updateRecordingPause` uses the new gate and speaks the reason ("Recording paused — …", "Fixed — recording again"); a held-up product overrides topic zoom with tight fill framing (works silently), director line narrates it.
- Tests: 3 new (presence rules, recording gate, held-near-face).

## 2026-11-04-prodfill — Product-only zoom
- Asked: when the product is in frame, zoom to just the product alone.
- `ZoomController.update({ detection, fill: true })` now sizes the zoom from the SAM box so the product fills the program output (small margin kept), capped at 3x. Small/far product → tight crop; already-close product → stays near-wide.
- `app.js` passes `fill` only for non-person focus; the person keeps the gentle fixed 1.7x push-in.
- Tests: fill frames a small box, stays wide on a big box, person unchanged.

## 2026-11-04-introcut — Opening voice cut from the recording too
- Asked: the agent's muted opening speech still left dead video at the start; the file should begin when the user begins.
- `speak()` takes an optional `onDone`; the video recorder now rolls only after the opening voice finishes (starts immediately when voice is off; backstop timer covers speech failure).
- Stopping during the intro shows "stopped before the intro finished" instead of a stale status.
- Browser-only behavior (speech + MediaRecorder): no maintained test possible in the node harness; verified by syntax check + suite green + manual recording check.

## 2026-11-04-handbag — Handbag video + occasion switching + forgot list
- Asked: occasion should switch the checklist by default; new session got stuck on birthday; "tell me if I forget anything"; handbag must fully work on video with SAM + Spark only.
- `agent-core.js`: handbag/bag/purse map the occasion to the product template; focusable words (handbag, phone…) count as mentions in any template and as visual topics, so a talked-about handbag zooms and raises "mentioned but not visible" alerts; new `isNewSessionRequest` ("new session", "start over") and `isForgotQuery` ("what did I forget…") intents.
- `app.js`: photo re-pick uses the photo occasion (not the video suggester), so "photo of my handbag" switches; "new session" resets to a fresh setup; "what did I forget?" speaks the remaining beats mid-session or after; stop summary speaks forgotten items aloud.
- Tests: 4 new (handbag occasion/mention, handbag missing alert, new-session intent, forgot query).

## Meta-only cleanup (no behavior change)
- Asked: keep the code SAM + Spark only, TensorFlow gone.
- Verified by search: zero TF/tfjs/COCO code, zero npm dependencies, no CDN scripts; browser calls same-origin `/api/*` only, server calls `https://api.meta.ai/v1` only.
- Reworded two stale mentions: a `COCO-SSD` comment (now SAM) and a MediaPipe future-work example in the README (now generic).
