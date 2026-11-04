# SoloDirectorAI — Goals
## One file: each goal, its input, its output, and how you know it is done

### How to read this file
- **Input** = what you give the app / what you need before the goal starts
- **Output** = what the app gives you back / what you should have at the end of the goal
- **Done when** = the one check that proves the goal is complete, no extra tests needed

---

## Goal 0 — Setup
- **Input:** Laptop, Chrome/Edge, VS Code + Live Server, camera + mic permission, Meta API key (in your head / safe place, not in a file)
- **Output:** `SoloDirectorAI/index.html` opened with Live Server at `127.0.0.1:5500`, hero header + step tracker 1–8 visible, Start Conversation button visible
- **Done when:** Page loads, no blank screen, camera + mic can be allowed

## Goal 1 — Conversation
- **Input:** Your voice or typed words: mode (photos / video / both) + occasion in your own words (selfie, birthday, dish, skincare review, vlog, LinkedIn headshot)
- **Output:** App understands mode + occasion + ready together, never re-asks a filled slot, waits for you after each turn, stops once only on "stop"
- **Done when:** One-go sentence works, stop works once, no loop, no repeat question

## Goal 2 — Camera + Session ON
- **Input:** "I'm ready" + "Yes / All good"
- **Output:** Camera opens, session turns ON, conversation stays listening the whole shoot, camera stops on Stop
- **Done when:** Voice "capture" works, voice "stop" works, resume within 60 sec returns to same session without repeat questions

## Goal 3 — Photo Guidance
- **Input:** A captured photo + your ticks: face visible, looking, smile, hair neat, cake visible (if cake)
- **Output:** Guidance list with ONLY unticked points, in plain words + voice for first missing point, plus Save Best Photo download, plus Group Countdown 5-4-3-2-1 + auto capture
- **Done when:** Guidance matches your ticks exactly, Save Best downloads, countdown + Stop gives NO photo after Stop

## Goal 4 — SAM + Product in Frame
- **Input:** A captured photo + Important item noun you type (person, cake, bottle, tube, book, phone, dish, crochet) + Meta API key in browser key box only
- **Output:** SAM HTTP 200 + box (centre %, width %, height %) + guidance: centred / move left / move right / partly in frame / too close / MISSING, plus SAM Auto Zoom (small → 2x, medium → 1.5x, large → 1x, no zoom buttons)
- **Done when:** With-you = box, without-you = no box / partly, small edge fragment ≠ "good", turned box ≠ failure, SAM tests captured photo only (not live frame), product missing → "Reminder, product is not in frame"

## Goal 5 — Live Session
- **Input:** Pre-brief: what you are making today (birthday, crochet top, ingredients list, bottle review)
- **Output:** Auto-capture about every 10 sec + Capture Now photos + gallery + session status, with SAM Auto Zoom following the box
- **Done when:** Gallery grows without "capture" commands, Capture Now adds a photo immediately, Stop ends auto-capture

## Goal 6 — Video Recording + Video Frame Analysis
- **Input:** "Record" + pre-brief items (ingredients, crochet, bottle) + your performance in front of a fixed phone
- **Output:** Video file + Takes list + Good / Empty marks + trim list + best take (only after your approval), PLUS voice while recording:
  - Sampled frame check every ~5–10 sec, one noun at a time
  - If missing: voice "Crochet is not visible — bring it into frame." / "Onion is missing from this frame." / "Bottle is not in frame."
  - If visible: quiet, or "Good, crochet visible."
  - Missing person (sampled, a few seconds late): "You are not in this, come into the frame."
- **Done when:** Video records + stops by voice, trim list works, best take downloads only after approval, missing during video is spoken

## Goal 7 — Voice Commands + Transcript Checklist
- **Input:** Voice commands ("guidance", "save best", "capture", "stop", "Chitti, take my photo") + a typed checklist (ingredients / steps) you want to say
- **Output:** Commands work hands-free, checklist ticks as you say items, answer to "What did I forget to say?" = ONLY items you did NOT say
- **Done when:** Hands-free control works, forgot-to-say list is correct. Note: MVP transcript is browser speech, Meta Voice Transcribe is stretch goal.

## Goal 8 — Edit + Ready to Post
- **Input:** Best take + best photo + trim list + your tick "I checked"
- **Output:** Edit output (best take + best photo + trim list together) + "Ready to Post: YES"
- **Done when:** Ready to Post: YES appears ONLY after your tick, and NOTHING is posted automatically — you post manually, nothing is auto-deleted

## Goal 9 — Front End (Interactive, Step-Screen)
- **Input:** End-to-end file, no new features, CSS/layout only
- **Output:** Hero header + step tracker 1–8 + cards + top "Go to" bar, ONE screen visible at a time, buttons lift on hover / press, SAM Auto Zoom status visible, no manual zoom buttons visible
- **Done when:** Demo looks like a modern website, one screen at a time, and happy path still passes after UI change

## Goal 10 — Missing Detection (Photo, Video, Live — all three)
- **Input:** Any important item noun + a photo / video frame / live frame
- **Output:** If missing: "MISSING: [item] is missing from this frame / photo. Bring it into frame and capture / record again." — in words and on screen, by voice in live/video sessions. If visible: "Good, [item] visible" or quiet. Never "centered good" for a missing / tiny fragment.
- **Done when:** Person missing, cake missing, bottle missing, tomato missing, crochet missing — each is spoken/shown as missing, not silent

## Goal 11 — Demo + Release
- **Input:** Demo 1 (birthday cake-cutting, photo) + Demo 2 (crochet OR skincare review, video) + write-up starting with "creator moment assistant"
- **Output:** Demo video (rehearsed twice, full loop: pre-brief → live check → guidance → retake → Save Best → simple video trim) + write-up + end-to-end file ready to share
- **Done when:** You can explain the project in 2 minutes: problem → solution → live loop → best output, and the demo shows the loop, not a one-shot score

## Summary table — input → output, at a glance
| Goal | Input | Output |
|---|---|---|
| 0 Setup | Laptop, browser, key | Live page running |
| 1 Conversation | Mode + occasion words | Understood mode + occasion, waits, stops once |
| 2 Camera | "I'm ready" + "All good" | Camera open, session ON, voice capture/stop |
| 3 Guidance | Photo + ticks | Missing-only guidance + Save Best + countdown |
| 4 SAM | Captured photo + noun + key | Box + centre/size/edge + Auto Zoom + missing |
| 5 Live Session | Pre-brief | Auto-capture 10 sec + gallery |
| 6 Video | Record + pre-brief items | Video + takes + trim + best take + spoken missing |
| 7 Voice + Transcript | Voice commands + checklist | Hands-free control + forgot-to-say list |
| 8 Edit | Best take + photo + trim + tick | Ready to Post: YES, manual post only |
| 9 Front End | End-to-end file | Step-screen modern UI, one screen at a time |
| 10 Missing | Item noun + frame | "MISSING: [item] is missing" or "Good, visible" |
| 11 Demo + Release | Demo 1 + Demo 2 + write-up | Demo video + write-up ready to share |
