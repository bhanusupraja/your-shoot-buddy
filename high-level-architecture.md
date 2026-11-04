# SoloDirectorAI — High-Level Architecture

## One-line architecture
A front-end-only web app in the browser, with a single-agent multi-model flow: the creator talks, the browser captures, SAM sees, Muse Spark guides, and the creator saves and posts the best moments manually.

## High-level diagram

```
You (solo creator, fixed phone, no crew)
  ↓ talk / type / tick
Browser App — 1 HTML file, Live Server
  ├─ Talk: mode + occasion + ready
  ├─ Camera: session ON, fixed phone
  ├─ Capture: photo, video, gallery, takes
  ├─ Guide: ticks, voice guidance, Save Best
  └─ Front end: step-screen, 1 screen at a time
  ↓ HTTPS, key from browser box only
Meta APIs
  ├─ SAM 3.1: sees person / item, gives a box
  └─ Muse Spark: box → plain words
  ↓
You (retake, choose best, post manually)
```

## 4 layers only

### 1. Creator layer
- Who: solo / beginner creator, shooting alone at home
- Does: talks first, performs, ticks guidance, chooses best, posts manually
- Needs: no photography, editing, or gimbal skill

### 2. Browser app layer
- What: single HTML file, `solodirectorai-end-to-end-final.html`, run via VS Code Live Server
- Does: conversation, camera, capture, guidance, live session, video takes, edit, front end
- Does NOT do: backend server, database, auto-post, auto-delete
- Storage, local only: API key in browser key box (localStorage), conversation restore, resume session
- Front end: interactive step-screen UI, hero header, step tracker 1–8, one screen at a time

### 3. Meta AI layer
- SAM 3.1: sees a captured photo, returns a box for a plain noun (person, cake, bottle, tube, book, phone, dish, crochet)
  - Used for: centre guidance, product-in-frame check, missing detection, SAM Auto Zoom
  - Does NOT do: judge facing, smile, or hair
- Muse Spark: turns SAM box data into plain-language guidance
  - Examples: "move left a little", "product not in frame — bring it closer", "smile a bit"
- Muse Voice Transcribe: stretch goal only
  - MVP uses browser SpeechRecognition instead, honestly stated

### 4. Output layer
- Best photo download, best take download, trim list
- Edit output: best take + best photo + trim list + "I checked" → Ready to Post: YES
- Creator posts manually on her own platform
- No auto-post, no auto-delete, best only after creator approval

## Key flows, high level only
- Talk → Ready → Camera → All good → Session ON
- Capture → Guide → Retake → Save Best
- SAM check (captured photo only) → Centre / size / edge → Guidance + Auto Zoom
- Missing check → No box / tiny fragment → "MISSING: [item] is missing" (photo, video frame, live frame)
- Live session → Auto-capture ~10 sec + Capture Now → Gallery
- Video → Record → Good / Empty marks → Trim list → Best take
- Video frame analysis → Pre-brief items → Sample every ~5–10 sec → Speak if missing, quiet if visible
- Stop → Once only, camera stops too → Resume within 60 sec, same session, no repeat questions

## Key decisions, high level
- Front-end-only: enough for MVP, runs on CPU-only laptop, no server to deploy
- Single-agent, multi-model: one flow, SAM sees + Spark words, no multi-agent complexity
- No database in MVP: takes live in-page + downloads, save best before closing
- SAM Auto Zoom, no zoom buttons: SAM box size decides zoom (small → 2x, medium → 1.5x, large → 1x)
- Step-screen front end: one screen at a time, clean for demo, not all sections stacked

## What this architecture is NOT
- Not a native Play Store app (web app in browser, sufficient for demo)
- Not a backend / cloud system
- Not a multi-agent system
- Not continuous tracking, not perfect transcript, not auto-posting
- Not a claim that SAM judges facing, smile, or hair
