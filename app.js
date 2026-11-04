/* Solo Cameraman — UI wiring. Depends on window.CameramanCore (agent-core.js).
   Detection: SAM 3.1 via the local /api/sam proxy when a key is set,
   simulator fallback otherwise. Topics: keywords instantly + Spark. */
(function () {
  'use strict';
  var Core = window.CameramanCore;
  if (!Core) {
    document.getElementById('directorLine').textContent =
      'agent-core.js failed to load. Serve this folder and reload.';
    return;
  }

  var APP_BUILD = '2026-11-04-welcome'; // bump on every behavior change; shown in the Ready log

  function $(id) { return document.getElementById(id); }

  var els = {
    topbar: $('topbar'), sessionState: $('sessionState'), timer: $('timer'),
    templateCards: $('templateCards'), occasion: $('occasion'), userName: $('userName'),
    setupChat: $('setupChat'), setupChips: $('setupChips'),
    setupInput: $('setupInput'), btnSetupSend: $('btnSetupSend'),
    modeVideo: $('modeVideo'), modePhoto: $('modePhoto'),
    photoPanel: $('photoPanel'), photoStrip: $('photoStrip'), photoBest: $('photoBest'),
    btnCapture: $('btnCapture'), btnBurst: $('btnBurst'), gestureState: $('gestureState'),
    simHand: $('simHand'), pillLight: $('pillLight'), voiceMode: $('voiceMode'),
    pillMic: $('pillMic'), btnMic: $('btnMic'), hearingLine: $('hearingLine'),
    checklistEdit: $('checklistEdit'), btnCamera: $('btnCamera'), btnReady: $('btnReady'),
    btnStop: $('btnStop'), voiceOn: $('voiceOn'), listenOn: $('listenOn'),
    cam: $('cam'), preview: $('preview'), program: $('program'),
    pillFrame: $('pillFrame'), pillPerson: $('pillPerson'), pillSubject: $('pillSubject'),
    pillZoom: $('pillZoom'), pillTopic: $('pillTopic'),
    recStatus: $('recStatus'), download: $('download'),
    simOn: $('simOn'), simPerson: $('simPerson'), simSubject: $('simSubject'),
    simPersonX: $('simPersonX'), btnTestVoice: $('btnTestVoice'),
    directorLine: $('directorLine'), coverageBar: $('coverageBar'), coverageText: $('coverageText'),
    checklistChips: $('checklistChips'), transcript: $('transcript'),
    sayBox: $('sayBox'), btnSay: $('btnSay'), eventLog: $('eventLog'),
    simpleAgent: $('simpleAgent'), simpleNext: $('simpleNext'),
    btnView: $('btnView'), btnWelcomeStart: $('btnWelcomeStart'),
    btnTalk: $('btnTalk'), btnSimpleCamera: $('btnSimpleCamera'),
    btnSimpleReady: $('btnSimpleReady'), btnSimpleCapture: $('btnSimpleCapture'),
    btnSimpleStop: $('btnSimpleStop'),
    btnSaveBest: $('btnSaveBest'), btnSaveAll: $('btnSaveAll')
  };

  var S = {
    templateId: 'recipe',
    checklist: new Core.ContentChecklist(Core.checklistForTemplate('recipe')),
    tracker: new Core.TopicTracker(),
    zoom: new Core.ZoomController(),
    alerts: new Core.AlertManager(),
    shutter: new Core.GestureShutter(),
    wave: new Core.HandWave(),
    pauseGate: new Core.RecordingPause(),
    recHasAudio: false,
    sessionActive: false,
    startMs: 0,
    detections: [],
    model: null,
    modelTried: false,
    recognition: null,
    recorder: null,
    micStream: null,
    audioCtx: null, micSource: null, micGain: null, mixedDest: null, graphStream: null,
    chunks: [],
    alertsFired: 0,
    recordPaused: false,
    speechPaused: false,
    lastSamOkMs: 0,
    cameraOn: false,
    mode: 'video', photoOccasion: null, photoSubject: null, photoTipIdx: 0,
    photoCount: 0, shots: [], bestScore: -1, bestNum: 0, bursting: false,
    light: 'good', lightMean: null, motionRatio: 0, motionMoving: false,
    bgBusy: false, handRaised: false,
    voiceMode: 'quiet', suppressMicUntil: 0, micState: 'off', speakingCount: 0,
    tourMode: false, showingUntilMs: 0,
    lastSpokenText: '', lastSpokenMs: 0,
    awayUntilMs: 0, selfTalkUntilMs: 0,
    lastHeldLabel: null, lastHeldMs: 0, lastUserSpeechMs: 0,
    recogStats: null, micDeadStreak: 0, micDeadWarned: false
  };

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function addLog(text, cls) {
    var li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = new Date().toLocaleTimeString() + ' — ' + text;
    els.eventLog.appendChild(li);
    while (els.eventLog.children.length > 120) els.eventLog.removeChild(els.eventLog.firstChild);
    els.eventLog.scrollTop = els.eventLog.scrollHeight;
  }

  function addTranscript(text, source) {
    var li = document.createElement('li');
    li.textContent = '(' + source + ') ' + text;
    els.transcript.appendChild(li);
    while (els.transcript.children.length > 40) els.transcript.removeChild(els.transcript.firstChild);
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  function mirrorSimpleAgent(text) {
    if (els.simpleAgent) els.simpleAgent.textContent = text;
  }

  // The recording must keep the creator's voice only: the mic runs through
  // a gain node and the recorder takes that node's track, so muting during
  // our own speech is sample-level on/off. The raw track's enabled flag is
  // deliberately never touched — on some builds it never comes back.
  // Speech recognition listens on its own path, unaffected by the gain.
  function setupAudioGraph() {
    if (!S.micStream) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!S.audioCtx || S.graphStream !== S.micStream) {
        try { if (S.audioCtx && S.audioCtx.close) S.audioCtx.close(); } catch (e) {}
        S.audioCtx = new AC();
        // Every node kept referenced: an unreferenced source gets garbage
        // collected and the destination goes permanently silent.
        S.micSource = S.audioCtx.createMediaStreamSource(S.micStream);
        S.micGain = S.audioCtx.createGain();
        S.mixedDest = S.audioCtx.createMediaStreamDestination();
        S.micSource.connect(S.micGain);
        S.micGain.connect(S.mixedDest);
        S.graphStream = S.micStream;
      }
      if (S.audioCtx.state === 'suspended') {
        S.audioCtx.resume().catch(function () { /* needs a user gesture; caller falls back */ });
      }
    } catch (e) { /* graph unavailable — raw track fallback */ }
  }

  function recorderAudioTracks() {
    if (S.mixedDest && S.audioCtx && S.audioCtx.state === 'running' && S.graphStream === S.micStream) {
      return Core.liveTracks(S.mixedDest.stream.getAudioTracks());
    }
    return S.micStream ? Core.liveTracks(S.micStream.getAudioTracks()) : [];
  }

  function setMicTrackEnabled(on) {
    // Track mute always applies: when the graph is idle the recorder eats
    // the raw mic, and this is what keeps my voice out of the saved video.
    // Speech recognition captures on its own stream, so it is unaffected.
    try {
      var live = S.micStream ? Core.liveTracks(S.micStream.getAudioTracks()) : [];
      live.forEach(function (t) { t.enabled = on; });
    } catch (e) { /* mic gone */ }
    if (!S.micGain || !S.audioCtx || S.audioCtx.state !== 'running') return;
    try { S.micGain.gain.value = on ? 1 : 0; } catch (e) { /* graph torn down */ }
  }

  function speak(text, kind, onDone) {
    addLog('Voice: ' + text, 'voice');
    mirrorSimpleAgent(text);
    if (!els.voiceOn.checked || !Core.voiceAllowed(S.voiceMode, kind || 'issue')) {
      if (typeof onDone === 'function') setTimeout(onDone, 0);
      return;
    }
    // The mic hears our own speaker: ignore mic input while talking.
    S.lastSpokenText = text;
    S.lastSpokenMs = Date.now();
    S.suppressMicUntil = Date.now() + Core.echoSuppressMs(text);
    setMicTrackEnabled(false);
    // Cut agent-speech time out of the FILE too, not just the audio: pause
    // while talking, silently resume when the last utterance ends (unless a
    // rule pause owns the recorder by then).
    if (S.sessionActive && S.mode === 'video' && S.recorder && S.recorder.state === 'recording') {
      try { S.recorder.pause(); } catch (e) { /* fall through unpaused */ }
      if (S.recorder.state === 'paused') {
        S.speechPaused = true;
        S.recordPaused = true;
        els.topbar.classList.add('paused');
        els.sessionState.textContent = 'Paused — agent speaking';
        els.recStatus.textContent = 'Paused while I speak…';
      }
    }
    // Unmute when every queued utterance finishes — by event, or by a backstop
    // timer each. Never trust the platform's speaking flags; they stick on.
    S.speakingCount = (S.speakingCount || 0) + 1;
    var utterDone = false;
    var finishUtterance = function () {
      if (utterDone) return;
      utterDone = true;
      S.speakingCount = Math.max(0, (S.speakingCount || 0) - 1);
      if (S.speakingCount === 0) {
        // Speech truly over (event, error, or backstop): shrink the long
        // echo window to a beat, so replies land but tails never did.
        S.suppressMicUntil = Date.now() + 600;
        setMicTrackEnabled(true);
        if (S.speechPaused) {
          S.speechPaused = false;
          if (!S.pauseGate.paused && S.recorder && S.recorder.state === 'paused') {
            S.recordPaused = false;
            try { S.recorder.resume(); } catch (e) { /* gate re-evaluates next tick */ }
            els.topbar.classList.remove('paused');
            els.sessionState.textContent = 'Recording';
            els.recStatus.textContent = S.recHasAudio
              ? 'Recording program output + mic audio…'
              : 'Recording program output (video only — mic unavailable)…';
          }
        }
      }
      if (typeof onDone === 'function') {
        try { onDone(); } catch (e) { /* callback must not break speech */ }
      }
    };
    setTimeout(finishUtterance, Core.echoSuppressMs(text) + 5000);
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.onend = u.onerror = finishUtterance;
      window.speechSynthesis.speak(u);
    } catch (e) {
      finishUtterance(); /* speech unavailable — log only */
    }
  }

  // ---- Demo API access ----
  // Judges open the hosted link with ?token=…; the token rides along on every
  // /api/* call and the proxy rejects anything without it. 401/429 surface
  // as a plain-language demo message, spoken once, never a crash.
  var DEMO_TOKEN = (function () {
    try {
      return new URLSearchParams(location.search).get('token') || '';
    } catch (e) {
      return '';
    }
  })();

  function apiHeaders() {
    var h = { 'Content-Type': 'application/json' };
    if (DEMO_TOKEN) h['x-demo-token'] = DEMO_TOKEN;
    return h;
  }

  function demoBlocked(kind) {
    if (kind === 'token' && !S.tokenWarned) {
      S.tokenWarned = true;
      addLog('Demo link needs a valid token — vision and reasoning paused.', 'alert');
      speak('This demo link needs a valid token.', 'issue');
    }
    if (kind === 'paused' && !S.pausedWarned) {
      S.pausedWarned = true;
      addLog('Demo paused — daily limit reached. Try again tomorrow.', 'alert');
      speak('Demo paused for today — daily limit reached.', 'issue');
    }
  }

  function noteApiBlock(res) {
    if (!res || res.status !== 429) return null;
    return res.json().then(function (b) {
      return b && b.error ? b.error : 'rate-limited';
    }).catch(function () {
      return 'rate-limited';
    });
  }

  // ---- Template setup ----
  function renderTemplates() {
    els.templateCards.innerHTML = '';
    Core.listTemplates().forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'template-card' + (t.id === S.templateId ? ' selected' : '');
      b.innerHTML = '<strong></strong><span></span>';
      b.querySelector('strong').textContent = t.label;
      b.querySelector('span').textContent = t.description;
      b.onclick = function () { selectTemplate(t.id); };
      els.templateCards.appendChild(b);
    });
  }

  var TEMPLATE_OCCASIONS = {
    recipe: 'Making biryani for YouTube',
    vlog: 'Day vlog in the city',
    product: 'Reviewing my new headphones',
    tutorial: 'How to fix a puncture',
    custom: 'My video'
  };

  // The person is only demanded on camera when self-talk needs them AND
  // no tour/showing context says otherwise (showing the room means being
  // out of frame is correct).
  function personNeeded(now) {
    if (S.tourMode) return false;
    if (now < S.showingUntilMs) return false;
    return now < S.selfTalkUntilMs;
  }

  function selectTemplate(id, occasionText) {
    S.tourMode = false;
    S.checklistConfirmed = false;
    S.templateId = id;
    S.mode = 'video';
    updateModeUI();
    els.checklistEdit.value = Core.checklistForTemplate(id).join(', ');
    if (!S.sessionActive) {
      S.checklist = new Core.ContentChecklist(Core.checklistForTemplate(id));
      renderChecklist();
    }
    renderTemplates();
    els.occasion.value = occasionText || TEMPLATE_OCCASIONS[id] || 'My video';
    addLog('Template: ' + Core.getTemplate(id).label);
  }

  // ---- Setup conversation: greet -> ask occasion -> confirm template ----
  var MODE_CHIPS = [
    { label: 'Take photos', mode: 'photo' },
    { label: 'Record a video', mode: 'video' }
  ];
  var PHOTO_CHIPS = [
    { label: 'Selfie', template: 'selfie' },
    { label: 'Birthday', template: 'birthday' },
    { label: 'Group photo', template: 'group' },
    { label: 'Something else', template: '__ask' }
  ];
  var SETUP_CHIPS = {
    start: [
      { label: 'Take photos', mode: 'photo' },
      { label: 'Record a video', mode: 'video' },
      { label: 'Just looking around' }
    ],
    occasion: [
      { label: 'Cooking a recipe', template: 'recipe' },
      { label: 'Daily vlog', template: 'vlog' },
      { label: 'Product review', template: 'product' },
      { label: 'How-to tutorial', template: 'tutorial' },
      { label: 'Something else', template: '__ask' }
    ]
  };
  S.setupStep = 'greet';
  S.setupEngaged = false;
  S.checklistConfirmed = false;

  function setupSay(who, text) {
    var d = document.createElement('div');
    d.className = 'bubble-' + who;
    d.textContent = text;
    els.setupChat.appendChild(d);
    els.setupChat.scrollTop = els.setupChat.scrollHeight;
  }

  function setupChips(list) {
    els.setupChips.innerHTML = '';
    list.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label;
      b.onclick = function () { setupUser(c.label, c); };
      els.setupChips.appendChild(b);
    });
  }

  function setupAgent(text) {
    setupSay('agent', text);
    speak(text, 'setup');
  }

  function checklistSuffix() {
    if (!S.checklist.items.length) return ' Your list is empty — say "add X" to build it, or type beats below.';
    return ' Your list: ' + S.checklist.items.join(', ') + ' — say "add X" or "remove Y" to change it.';
  }

  function nudgeChecklistLock() {
    var pending = parseChecklistEdit();
    setupAgent('First, lock your checklist: ' + (pending.length ? pending.join(', ') : 'empty') +
      ' — say "looks good", or "add X" / "remove Y".');
    setupChips([{ label: 'Looks good' }]);
  }

  function confirmSetup(templateId, occasionText) {
    selectTemplate(templateId, occasionText);
    S.mode = 'video';
    updateModeUI();
    S.setupStep = 'done';
    S.tourMode = Core.isTourSession(occasionText);
    if (S.tourMode) setupSay('agent', 'Tour mode — show the place freely; I will not ask you to stay in frame.');
    var name = els.userName.value.trim();
    var t = Core.getTemplate(templateId);
    if (templateId === 'product') {
      var focus = Core.suggestFocusObjects(occasionText || '');
      if (focus.length && !S.sessionActive) {
        var items = parseChecklistEdit();
        focus.forEach(function (f) {
          if (items.map(function (x) { return x.toLowerCase(); }).indexOf(f) === -1) items.push(f);
        });
        els.checklistEdit.value = items.join(', ');
        S.checklist = new Core.ContentChecklist(items);
        setupSay('agent', "I'll also keep these in focus when you mention them: " + focus.join(', ') +
          ". Say 'add X' or type in the checklist box to track more.");
        renderChecklist();
      }
    }
    if (templateId === 'custom') {
      setupSay('agent', 'Got it — "' + occasionText + '" it is! I have set a Custom session' +
        (name ? ' for you, ' + name : '') + '. First, lock your checklist below — say "looks good", or "add X" / "remove Y" — then start the camera and say "I\'m ready".' + checklistSuffix());
    } else {
      setupSay('agent', 'Wonderful' + (name ? ', ' + name : '') + ' — this looks like a ' + t.label +
        '! First, lock your checklist below — say "looks good", or "add X" / "remove Y" — then start the camera and say "I\'m ready".' + checklistSuffix());
    }
    speak('Check your checklist, say looks good, then start the camera.', 'setup');
    setupChips([{ label: 'Looks good' }]);
    renderChecklist();
  }

  function photoJudgeId() {
    return S.photoOccasion === 'birthday' ? 'recipe' : 'vlog';
  }

  // Everything the agent can verify right now: frame, light, motion, background.
  // skipBusy keeps the opening check punchy — a busy background is not worth
  // leading the session with (it can still surface on later look-questions).
  function currentIssues(opts) {
    var judge = S.mode === 'photo' ? photoJudgeId() : S.templateId;
    var frame = Core.analyzeFrame({ detections: S.detections, templateId: judge });
    var out = frame.issues.map(function (it) {
      var m = it.message;
      if (S.mode === 'photo' && S.photoOccasion === 'birthday') m = m.replace(/biryani dish/g, 'cake');
      return m.charAt(0).toLowerCase() + m.slice(1);
    });
    if (S.light === 'dark') out.push('your face needs more light');
    else if (S.light === 'washed') out.push('it is too bright — light is washing you out');
    if (S.motionMoving) out.push('hold still a beat');
    if (S.bgBusy && !(opts && opts.skipBusy)) out.push('the background looks busy');
    return { out: out, frame: frame };
  }

  function photoTip() {
    var tips = Core.suggestPhotoTips(S.photoOccasion || 'custom', S.photoSubject).tips;
    var t = tips[S.photoTipIdx % tips.length];
    S.photoTipIdx++;
    return t;
  }

  function lookAnswer() {
    if (!Core.visionReady(els.simOn.checked, S.cameraOn, !!S.model)) {
      return 'Camera is still warming up — ask me again in a moment.';
    }
    var c = currentIssues();
    if (!c.frame.person) return "I can't see you — step into the frame so I can check your look.";
    if (!c.out.length) {
      return "You're looking good — " + (S.mode === 'photo' ? photoTip() : 'Frame, light, and background check out.');
    }
    return 'Quick look check: ' + c.out.join('; ') + '.' + (S.mode === 'photo' ? ' ' + photoTip() : '');
  }

  function checklistHelpText() {
    var items = S.checklist.items;
    if (!items.length) {
      return 'This Custom session has no checklist yet — type beats into the checklist box above, separated by commas, and I will track them.';
    }
    var missing = S.checklist.getMissing();
    var base = 'Your checklist lives in the CHECKLIST panel on the right: ' + items.join(', ') + '. ';
    return base + (missing.length
      ? 'Still to mention on camera: ' + missing.join(', ') + '.'
      : 'All covered — nice work!');
  }

  function updateModeUI() {
    var photo = S.mode === 'photo';
    els.photoPanel.style.display = photo ? '' : 'none';
    els.modePhoto.className = photo ? 'primary' : '';
    els.modeVideo.className = photo ? '' : 'primary';
    els.btnReady.textContent = photo ? "I'm ready — start photo session" : "I'm ready — start recording";
  }

  els.modeVideo.onclick = function () {
    if (S.sessionActive) { addLog('Stop the session before switching mode.', 'alert'); return; }
    S.mode = 'video';
    updateModeUI();
    addLog('Video mode.');
  };
  els.modePhoto.onclick = function () {
    if (S.sessionActive) { addLog('Stop the session before switching mode.', 'alert'); return; }
    // Never assume the occasion: ask (selfie, birthday, group…) every time.
    routeMode('photo', '');
  };

  // Mode router: occasion stated up front ("birthday vlog") confirms at once,
  // otherwise the agent asks. Never re-asks what the user already said.
  function routeMode(gm, text) {
    S.mode = gm;
    updateModeUI();
    if (gm === 'photo') {
      var pl = Core.photoOccasionLabel(text);
      if (pl !== 'custom') {
        photoConfirm(pl, text);
        return;
      }
      S.setupStep = 'photo-occasion';
      setupAgent("Photos it is! What's the occasion — selfie, birthday, group, or something else?");
      setupChips(PHOTO_CHIPS);
      return;
    }
    var s = Core.suggestTemplate(text);
    if (s.confidence === 'high') {
      confirmSetup(s.templateId, text);
      return;
    }
    S.setupStep = 'occasion';
    setupAgent("Amazing — I'd love to record your moments! What's the occasion for this video?");
    setupChips(SETUP_CHIPS.occasion);
  }

  function photoConfirm(label, occasionText) {
    S.mode = 'photo';
    S.tourMode = Core.isTourSession(occasionText || '');
    S.checklistConfirmed = false;
    S.photoOccasion = label;
    S.photoSubject = label === 'object' ? (Core.photoSubject(occasionText || '') || 'the subject') : null;
    S.requestedShots = Core.parseCaptureCount(occasionText || '');
    var items = Core.photoShotList(label, S.photoSubject);
    els.checklistEdit.value = items.join(', ');
    if (!S.sessionActive) {
      S.checklist = new Core.ContentChecklist(items);
      renderChecklist();
    }
    els.occasion.value = occasionText || label;
    S.setupStep = 'done';
    updateModeUI();
    addLog('Photo session: ' + label + '.');
    var name = els.userName.value.trim();
    setupSay('agent', 'Locked in' + (name ? ', ' + name : '') + ' — ' + label +
      ' photo session! First, lock your shot list below — say "looks good", or "add X" / "remove Y" — then start the camera and say "I\'m ready". I score every shot and star the best.' +
      (S.requestedShots ? ' Noted — you want ' + S.requestedShots + ' photos.' : '') + checklistSuffix());
    speak('Photo session ready — say looks good, then start the camera.', 'setup');
    setupChips([{ label: 'Looks good' }]);
    renderChecklist();
  }

  function currentSetupName() {
    if (S.mode === 'photo') return 'your ' + (S.photoOccasion || 'custom') + ' photo session';
    return 'your ' + Core.getTemplate(S.templateId).label;
  }

  function applyChecklistEdit(edit) {
    var items = parseChecklistEdit();
    var low = edit.item.toLowerCase();
    if (edit.action === 'add') {
      if (items.some(function (x) { return x.toLowerCase() === low; })) {
        setupAgent('"' + edit.item + '" is already on your checklist.');
        return;
      }
      items.push(edit.item);
      setupAgent('Added "' + edit.item + '" to your checklist.');
    } else {
      var before = items.length;
      items = items.filter(function (x) { return x.toLowerCase() !== low; });
      if (items.length === before) {
        setupAgent('I could not find "' + edit.item + '" on the list. Current list: ' + (items.join(', ') || 'empty') + '.');
        return;
      }
      setupAgent('Removed "' + edit.item + '".');
    }
    els.checklistEdit.value = items.join(', ');
    var keepMentioned = S.checklist.mentioned;
    var keepOrder = S.checklist.order;
    S.checklist = new Core.ContentChecklist(items);
    S.checklist.mentioned = keepMentioned;
    S.checklist.order = (keepOrder || []).filter(function (o) {
      return items.some(function (x) { return x.toLowerCase() === String(o).toLowerCase(); });
    });
    renderChecklist();
  }

  function setupUser(text, chip) {
    text = (text || '').trim();
    if (!text) return;
    var templateHint = chip ? chip.template : null;
    var modeHint = chip ? chip.mode : null;
    S.setupEngaged = true;
    setupSay('user', text);
    els.setupChips.innerHTML = '';
    // Parroted agent lines ("got it sticking with…", "say looks good or
    // add x") must never confirm occasions or reset checklists.
    if (!templateHint && Core.isAgentParrot(text)) {
      addLog('Parrot ignored — that was my line.');
      setupAgent('That was my line — tell me in your own words.');
      return;
    }
    var intent = Core.setupIntent(text, S.setupStep);
    if (S.setupStep === 'greet') {
      if (intent === 'browse') {
        S.setupStep = 'done';
        setupAgent('No rush — pick a template below any time, or type your occasion here and I will set things up.');
      } else {
        var gm = modeHint || Core.detectMode(text);
        if (!gm) {
          S.setupStep = 'mode';
          setupAgent('Photos or videos — what are we making today?');
          setupChips(MODE_CHIPS);
        } else {
          routeMode(gm, text);
        }
      }
      return;
    }
    if (S.setupStep === 'mode') {
      var gm2 = modeHint || Core.detectMode(text);
      if (!gm2) {
        setupAgent('I did not catch that — photos or videos?');
        setupChips(MODE_CHIPS);
      } else {
        routeMode(gm2, text);
      }
      return;
    }
    if (S.setupStep === 'photo-occasion') {
      // "I'm ready" must never become the occasion — ask again instead.
      if (!templateHint && Core.setupIntent(text, 'done') === 'ready') {
        setupAgent("Ready? Occasion first — selfie, birthday, group, or what?");
        return;
      }
      if (templateHint === '__ask') {
        setupAgent('Tell me in your own words — selfie, birthday, group, or what?');
        return;
      }
      var plabel = (templateHint && templateHint !== '__ask') ? templateHint : Core.photoOccasionLabel(text);
      photoConfirm(plabel, text);
      return;
    }
    if (S.setupStep === 'occasion') {
      // "I'm ready" must never become the occasion — ask again instead.
      if (!templateHint && Core.setupIntent(text, 'done') === 'ready') {
        setupAgent("Ready? Occasion first — what's the video about?");
        return;
      }
      if (templateHint === '__ask') {
        setupAgent("Tell me in your own words — what's the video about?");
        return;
      }
      if (templateHint) {
        confirmSetup(templateHint, text);
        return;
      }
      confirmSetup(Core.suggestTemplate(text).templateId, text);
      return;
    }
    // One-breath "looks good, I'm ready" (either order): lock the list,
    // then flow into the ready branch below (camera check included).
    if (!templateHint && !S.sessionActive && Core.parseLockReady(text)) {
      S.checklist = new Core.ContentChecklist(parseChecklistEdit());
      S.checklistConfirmed = true;
      renderChecklist();
      addLog('Checklist locked by voice — rolling check next.');
      intent = 'ready';
    }
    // Done step: mode switch, ready, look, help — or a confident re-pick.
    if (!templateHint) {
      var dm = Core.detectMode(text);
      if (dm && dm !== S.mode) {
        if (S.sessionActive) {
          setupAgent('We are rolling, so I will stay put. Stop the session first if you want to switch mode.');
        } else {
          routeMode(dm, text);
        }
        return;
      }
    }
    // "New session" resets the occasion instead of sticking with the old one.
    if (!templateHint && !S.sessionActive && Core.isNewSessionRequest(text)) {
      var nm = Core.detectMode(text);
      S.photoOccasion = null;
      if (nm) {
        addLog('New session requested — switching setup.');
        routeMode(nm, text);
      } else {
        S.setupStep = 'mode';
        setupAgent('Fresh start! Photos or videos — what are we making this time?');
        setupChips(MODE_CHIPS);
      }
      return;
    }
    if (!templateHint && S.sessionActive && Core.isNewSessionRequest(text)) {
      setupAgent('We are rolling — say "stop" first, then tell me the new occasion and I will switch the checklist.');
      return;
    }
    if (intent === 'ready') {
      if (S.sessionActive) {
        setupAgent('Already rolling — I am watching the frame and your checklist.');
      } else if (!S.cameraOn && !els.simOn.checked) {
        setupAgent('Almost — start the camera or tick "Simulate detections" first, then say "I\'m ready" and I will roll.');
      } else if (!S.checklistConfirmed) {
        nudgeChecklistLock();
      } else {
        setupAgent('On it — rolling!');
        startSession();
      }
      return;
    }
    // Approval first: pre-session "looks good" locks the checklist (as the
    // README promises) instead of running a look check. In-session look
    // questions are unaffected — handleLine has no approval branch.
    if (!templateHint && Core.isApproval(text)) {
      if (!S.sessionActive) {
        S.checklist = new Core.ContentChecklist(parseChecklistEdit());
        renderChecklist();
      }
      S.checklistConfirmed = true;
      if (S.sessionActive) {
        setupAgent('Already rolling — I am watching the frame and your checklist.');
      } else if (!S.cameraOn && !els.simOn.checked) {
        setupAgent('Checklist locked. Start the camera or tick "Simulate detections", then say "I\'m ready" and I will roll.');
      } else {
        setupAgent('Locked in — say "I\'m ready" and I roll.');
      }
      return;
    }
    if (Core.isLookQuestion(text)) {
      var ans = lookAnswer();
      addLog('Look check: ' + ans);
      setupAgent(ans);
      return;
    }
    if (intent === 'help' || (!templateHint && Core.isForgotQuery(text))) {
      setupAgent(checklistHelpText());
      return;
    }
    var edit = !templateHint ? Core.parseChecklistEdit(text) : null;
    if (edit) {
      applyChecklistEdit(edit);
      return;
    }
    if (S.sessionActive) {
      setupAgent('We are rolling, so I will keep this template. Stop the session first if you want to switch occasion.');
      return;
    }
    // Photo re-pick uses the photo occasion (selfie/birthday/group/object),
    // not the video template suggester — "photo of my handbag" must switch
    // even though it has no video keywords.
    if (S.mode === 'photo') {
      var pl2 = Core.photoOccasionLabel(text);
      if (pl2 !== 'custom' && (pl2 !== S.photoOccasion || pl2 === 'object')) {
        addLog('Occasion switched — new photo checklist.');
        photoConfirm(pl2, text);
        return;
      }
    }
    var s2 = Core.suggestTemplate(text);
    if (s2.confidence === 'high' && S.mode === 'video') {
      addLog('Occasion switched — new checklist: ' + Core.getTemplate(s2.templateId).label + '.');
      confirmSetup(s2.templateId, text);
    } else if (!templateHint && dm && dm === S.mode) {
      // Bare "take photos" / "record a video": guide to a fresh occasion
      // instead of sticking with the old session forever.
      addLog('New ' + dm + ' round — asking occasion.');
      routeMode(dm, text);
      return;
    } else {
      addLog('Heard: keeping ' + currentSetupName() + '.');
      if (Date.now() - (S.lastStickMsgMs || 0) > 30000) {
        S.lastStickMsgMs = Date.now();
        setupAgent('Got it — sticking with ' + currentSetupName() + '. Describe a new occasion any time to switch.');
      }
    }
  }

  els.btnSetupSend.onclick = function () {
    setupUser(els.setupInput.value);
    els.setupInput.value = '';
  };
  els.setupInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') els.btnSetupSend.click();
  });

  function parseChecklistEdit() {
    return els.checklistEdit.value.split(/[,\n]/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  function renderChecklist() {
    els.checklistChips.innerHTML = '';
    var mentioned = {};
    S.checklist.getMentioned().forEach(function (m) { mentioned[String(m).toLowerCase()] = true; });
    S.checklist.items.forEach(function (item) {
      var d = document.createElement('span');
      d.className = 'check' + (mentioned[String(item).toLowerCase()] ? ' done' : '');
      d.textContent = (mentioned[String(item).toLowerCase()] ? '✓ ' : '') + item;
      els.checklistChips.appendChild(d);
    });
    var cov = S.checklist.getCoverage();
    var got = S.checklist.getMentioned().length, total = S.checklist.items.length;
    els.coverageBar.style.width = Math.round(cov * 100) + '%';
    els.coverageText.textContent = got + ' / ' + total + ' covered';
    if (els.simpleNext && (S.setupStep === 'done' || S.sessionActive)) {
      var missing = S.checklist.getMissing();
      els.simpleNext.textContent = !total
        ? 'Checklist is empty — say “add X” to build it.'
        : missing.length
          ? 'Up next: ' + missing[0] + ' (' + got + '/' + total + ' covered)'
          : 'All ' + total + ' covered — nice work!';
    }
  }

  // ---- Camera ----
  function refreshReady() {
    els.btnReady.disabled = S.sessionActive || !(S.cameraOn || els.simOn.checked);
  }
  els.simOn.addEventListener('change', function () {
    refreshReady();
    addLog(els.simOn.checked ? 'Simulator on — you can start without a camera.' : 'Simulator off.');
  });
  // Simulator toggles apply instantly instead of waiting for the 700ms tick.
  ['simOn', 'simPerson', 'simSubject'].forEach(function (id) {
    els[id].addEventListener('change', function () {
      if (els.simOn.checked) S.detections = simulatedDetections();
    });
  });
  els.simPersonX.addEventListener('input', function () {
    if (els.simOn.checked) S.detections = simulatedDetections();
  });
  function updateCameraButtons() {
    var label = S.cameraOn ? 'Stop camera' : 'Start camera';
    els.btnCamera.textContent = label;
    els.btnSimpleCamera.textContent = label;
  }

  function stopCamera() {
    if (!S.cameraOn) {
      addLog('Camera is already off.');
      return;
    }
    try {
      var stream = els.cam.srcObject;
      if (stream) stream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) {} });
      els.cam.srcObject = null;
    } catch (e) { /* already released */ }
    S.cameraOn = false;
    S.detections = [];
    refreshReady();
    updateCameraButtons();
    addLog('Camera stopped.');
    speak('Camera is off.', 'answer');
  }

  function toggleCamera() {
    if (S.cameraOn) stopCamera();
    else startCamera();
  }

  function startCamera() {
    if (S.cameraOn) {
      addLog('Camera is already on.');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addLog('Camera API unavailable — use the simulator below.', 'alert');
      speak('Camera is not available here — tick Simulate detections instead.');
      return;
    }
    addLog('Starting camera…');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } } })
      .then(function (stream) {
        els.cam.srcObject = stream;
        return els.cam.play();
      })
      .then(function () {
        S.cameraOn = true;
        refreshReady();
        updateCameraButtons();
        addLog('Camera started.');
        speak('Camera is on. Say I am ready when you are ready.');
        tryLoadDetector();
      })
      .catch(function (err) {
        addLog('Camera blocked (' + (err && err.name || 'error') + ') — serve over localhost and allow access, or use the simulator.', 'alert');
        speak('Camera is blocked — allow access, or tick Simulate detections.');
      });
  }
  els.btnCamera.onclick = toggleCamera;

  // ---- Detector (SAM 3.1 via the local proxy, or simulator) ----
  function tryLoadDetector() {
    if (S.modelTried) return;
    S.modelTried = true;
    fetch('/api/health').then(function (r) { return r.json(); }).then(function (h) {
      if (h && h.sam) {
        S.model = { sam: true };
        addLog('Vision ready (SAM 3.1 + Spark via local proxy).');
      } else {
        addLog('No Meta API key on the server — camera vision off; simulator is the fallback. Set MODEL_API_KEY and restart.');
      }
    }).catch(function () {
      addLog('Vision proxy unreachable — simulator is the fallback.', 'alert');
    });
  }

  function simLabelForTemplate() {
    if (S.templateId === 'recipe') return 'bowl';
    if (S.templateId === 'product') return 'bottle';
    return 'book';
  }

  function simulatedDetections() {
    var out = [];
    var t = Date.now() / 1000;
    if (els.simPerson.checked) {
      var px = els.simPersonX.value / 100 + Math.sin(t / 2) * 0.02;
      out.push({ label: 'person', score: 0.92, bbox: [px - 0.13, 0.2, 0.26, 0.6] });
    }
    if (els.simSubject.checked && Core.getTemplate(S.templateId).primarySubject !== 'person') {
      out.push({ label: simLabelForTemplate(), score: 0.85, bbox: [0.62 + Math.cos(t / 2) * 0.015, 0.55, 0.22, 0.3] });
    }
    return out;
  }

  setInterval(function () {
    if (els.simOn.checked) {
      S.detections = simulatedDetections();
      S.lastSamOkMs = Date.now();
    }
  }, 700);

  // SAM cadence: one snapshot every few seconds, person + one subject noun.
  // Per-frame cloud segmentation would be slow and burn quota; the frame
  // judge, zoom, and alerts all work fine on 4-second detections.
  var samInFlight = false, samFailStreak = 0, samFailLogged = false;

  function samSubjectPrompt() {
    if (S.mode === 'photo') {
      if (S.photoOccasion === 'birthday') return 'cake';
      if (S.photoOccasion === 'object' && S.photoSubject) {
        return S.photoSubject.replace(/^(the|my|this|that|a|an)\s+/, '');
      }
      return null;
    }
    var id = Core.getTemplate(S.templateId).id;
    if (id === 'recipe') return 'biryani';
    if (id === 'product' || id === 'tutorial' || id === 'custom') {
      var active = S.tracker ? S.tracker.getActive(Date.now()) : null;
      // Self-references are never a SAM query: asking vision for "the
      // camera" burns a call on the device doing the filming.
      if (active === 'camera' || active === 'cam') active = null;
      if (active && Core.isFocusableWord(active)) return active;
      // Then the sticky held object: the topic went quiet but the thing is
      // still at the face, so keep asking SAM for it and the zoom sticks.
      var sticky = Core.stickySubject(S.lastHeldLabel, S.lastHeldMs, Date.now());
      if (sticky) return sticky;
      // Fall back to a concrete checklist noun so SAM is always asked for
      // something real ("handbag" from "handbag review") — never person-only
      // just because no topic is active yet or the topic is abstract.
      if (S.checklist && S.checklist.items) {
        for (var i = 0; i < S.checklist.items.length; i++) {
          var words = String(S.checklist.items[i]).toLowerCase().split(/[^a-z]+/);
          for (var j = 0; j < words.length; j++) {
            if (Core.isFocusableWord(words[j])) return words[j];
          }
        }
      }
    }
    return null;
  }

  var samSnapCanvas = null;
  function samSnapshot() {
    var v = els.cam;
    if (!samSnapCanvas) samSnapCanvas = document.createElement('canvas');
    // 640px keeps small/far people recognizable to SAM; larger only costs payload.
    var scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
    samSnapCanvas.width = Math.max(2, Math.round(v.videoWidth * scale));
    samSnapCanvas.height = Math.max(2, Math.round(v.videoHeight * scale));
    samSnapCanvas.getContext('2d').drawImage(v, 0, 0, samSnapCanvas.width, samSnapCanvas.height);
    return samSnapCanvas.toDataURL('image/jpeg', 0.7);
  }

  function samPoll() {
    if (els.simOn.checked || !S.model || !S.cameraOn || samInFlight) return false;
    var v = els.cam;
    if (!v.videoWidth || v.readyState < 2) return false;
    var prompts = ['person'];
    var subj = samSubjectPrompt();
    if (subj && subj !== 'person') prompts.push(subj);
    var image;
    try {
      image = samSnapshot();
    } catch (e) {
      return false;
    }
    samInFlight = true;
    Promise.all(prompts.map(function (p) {
      var ctrl = null;
      try { ctrl = new AbortController(); } catch (e) { ctrl = null; }
      var timer = null;
      if (ctrl) {
        // A hung poll must never wedge samInFlight (and freeze detections)
        // forever: time out and let the next poll retry.
        timer = setTimeout(function () { try { ctrl.abort(); } catch (e2) {} }, 20000);
      }
      var fetchOpts = {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ image: image, prompt: p })
      };
      if (ctrl) fetchOpts.signal = ctrl.signal;
      var settled = function () { if (timer) clearTimeout(timer); };
      return fetch('/api/sam', fetchOpts).then(function (r) {
        settled();
        if (r.status === 401) {
          demoBlocked('token');
          return { detections: [], _err: true };
        }
        if (r.status === 429) {
          return noteApiBlock(r).then(function (err) {
            if (err === 'demo-paused') demoBlocked('paused');
            return { detections: [], _err: true };
          });
        }
        return r.ok ? r.json() : { detections: [], _err: true };
      }).catch(function () {
        settled();
        return { detections: [], _err: true };
      });
    })).then(function (results) {
      samInFlight = false;
      var allErr = results.every(function (r) { return r._err; });
      samFailStreak = allErr ? samFailStreak + 1 : 0;
      if (allErr && samFailStreak >= 2 && !samFailLogged) {
        samFailLogged = true;
        addLog('SAM vision is failing — check the server log and MODEL_API_KEY. Keeping last detections.', 'alert');
        return;
      }
      if (allErr) return;
      var merged = [];
      results.forEach(function (r) {
        (r.detections || []).forEach(function (d) { merged.push(d); });
      });
      S.detections = merged;
      S.lastSamOkMs = Date.now();
      // Fresh eyes act at once: run the gate and alerts now instead of
      // waiting for the next 1s tick, so a walk-out pauses ~1s sooner.
      if (S.sessionActive) {
        try { tickAlerts(); } catch (e) { /* next interval covers it */ }
      }
    });
    return true;
  }
  // Self-scheduling polls: a slow fetch delays the next poll instead of
  // skipping a fixed-interval slot and stretching the effective rate.
  (function scheduleSamPoll(delayMs) {
    setTimeout(function () {
      var launched = false;
      try { launched = samPoll() === true; } catch (e) { launched = false; }
      scheduleSamPoll(Core.nextPollDelay(launched));
    }, delayMs);
  })(4000);

  // ---- Frame rendering + digital zoom ----
  var pctx = els.preview.getContext('2d', { willReadFrequently: true });
  var gctx = els.program.getContext('2d');
  var lastSampleMs = 0, prevLuma = null;

  function drawGuides(ctx, W, H) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    [.33, .66].forEach(function (f) {
      ctx.beginPath(); ctx.moveTo(W * f, 0); ctx.lineTo(W * f, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(52,201,142,0.5)';
    ctx.strokeRect(W * 0.25, H * 0.12, W * 0.5, H * 0.76);
  }

  function drawDetections(ctx, W, H) {
    S.detections.forEach(function (d) {
      var x = d.bbox[0] * W, y = d.bbox[1] * H, w = d.bbox[2] * W, h = d.bbox[3] * H;
      var isPerson = d.label === 'person';
      ctx.strokeStyle = isPerson ? '#34c98e' : '#f0b429';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = isPerson ? '#34c98e' : '#f0b429';
      ctx.font = '12px sans-serif';
      ctx.fillText(d.label + ' ' + Math.round(d.score * 100) + '%', x + 4, y + 14);
    });
  }

  function focusDetectionFor(activeTopic) {
    if (!activeTopic) return null;
    if (Core.isVisualTopic(activeTopic)) {
      var canonical = activeTopic === 'dish' ? 'biryani' : activeTopic;
      if (activeTopic === Core.getTemplate(S.templateId).primarySubject) {
        var fr = Core.analyzeFrame({ detections: S.detections, templateId: S.templateId });
        if (activeTopic === 'person') return fr.person;
        return fr.subject;
      }
      return Core.findDetection(S.detections, canonical);
    }
    // Named focus objects ("add charger"): zoom when the detector sees one;
    // unknown-to-the-detector words simply resolve to nothing, never an alert.
    return Core.findDetection(S.detections, activeTopic);
  }

  // Visual showing trigger: a product held up near the face zooms to the
  // product even when silent; taken away, the normal topic zoom returns.
  function heldProductDetection() {
    var person = Core.findDetection(S.detections, 'person');
    if (!person) return null;
    var best = null;
    (S.detections || []).forEach(function (d) {
      if (!d || d.score < 0.4 || String(d.label).toLowerCase() === 'person') return;
      if (!Core.isHeldNearFace(person.bbox, d.bbox)) return;
      if (!best || d.score > best.score) best = d;
    });
    return best;
  }

  // Pixel sampling ~2x/sec: real light / motion / background / hand readings.
  function sampleFrame() {
    try {
      var W = els.preview.width, H = els.preview.height;
      var d = pctx.getImageData(0, 0, W, H).data;
      var luma = [], i, x, y;
      for (i = 0; i < d.length; i += 64) luma.push((d[i] + d[i + 1] + d[i + 2]) / 3);
      var b = Core.frameBrightness(luma);
      S.light = b.verdict;
      S.lightMean = b.mean;
      if (prevLuma && prevLuma.length === luma.length) {
        var m = Core.frameMotion(prevLuma, luma);
        S.motionRatio = m.ratio;
        S.motionMoving = m.moving;
      }
      prevLuma = luma;
      S.bgBusy = Core.lumaVariance(luma).busy;
      els.pillLight.textContent = 'Light: ' + (S.light === 'good' ? 'Good' : S.light === 'dark' ? 'Dim' : 'Harsh');
      els.pillLight.className = 'pill' + (S.light === 'good' ? ' good' : ' warn');
      // Gesture: skin above/beside the head, never the face box itself.
      // Kept forgiving (wide side zone, modest skin share) so a high-five
      // reads even when framing is tight; the person box itself still gates.
      var person = Core.findDetection(S.detections, 'person');
      var rgb = [];
      if (person) {
        var fx0 = Math.max(0, person.bbox[0] - 0.12) * W, fx1 = Math.min(1, person.bbox[0] + person.bbox[2] + 0.12) * W;
        var fy1 = (person.bbox[1] + person.bbox[3] * 0.45) * H;
        for (i = 0; i < d.length; i += 40) {
          x = (i / 4) % W; y = Math.floor(i / 4 / W);
          if (y > fy1) continue;
          if (x > fx0 && x < fx1 && y > person.bbox[1] * H) continue;
          rgb.push(d[i], d[i + 1], d[i + 2]);
        }
      }
      var personGated = !!person && (Core.skinRatio(rgb) > 0.08 || els.simHand.checked);
      // Gesture anywhere: fixed frame bands catch a hand entering from any
      // side — or a palm shown to the camera in the center — even when
      // cropped too tight for person-box geometry.
      var zl = [], zr = [], zt = [], zc = [], si, nx, ny;
      for (si = 0; si < d.length; si += 40) {
        nx = (si / 4) % W / W; ny = Math.floor(si / 4 / W) / H;
        if (ny < 0.22) zt.push(d[si], d[si + 1], d[si + 2]);
        else if (ny > 0.70) continue;
        else if (nx < 0.18) zl.push(d[si], d[si + 1], d[si + 2]);
        else if (nx > 0.82) zr.push(d[si], d[si + 1], d[si + 2]);
        else if (nx > 0.35 && nx < 0.65) zc.push(d[si], d[si + 1], d[si + 2]);
      }
      var waved = S.wave.update(
        [Core.skinRatio(zl), Core.skinRatio(zr), Core.skinRatio(zt), Core.skinRatio(zc)],
        Date.now());
      S.handRaised = personGated || waved;
      // Photo capture is voice/button only: the hand-raise countdown is off,
      // so a photo is taken only when you say "capture" (or press Capture).
      S.shutter.reset();
      els.gestureState.textContent = 'Gesture: ' + (S.handRaised ? 'hand raised' : '—');
    } catch (e) { /* sampling is best-effort */ }
  }

  function frameLoop() {
    var W = els.preview.width, H = els.preview.height;
    var v = els.cam;
    pctx.fillStyle = '#000';
    pctx.fillRect(0, 0, W, H);
    var liveVideo = S.cameraOn && v.videoWidth;
    if (liveVideo) {
      var scale = Math.max(W / v.videoWidth, H / v.videoHeight);
      var dw = v.videoWidth * scale, dh = v.videoHeight * scale;
      pctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    var now = Date.now();
    var active = S.tracker.getActive(now);
    var held = S.sessionActive ? heldProductDetection() : null;
    // Sticky zoom: stamp every held sighting so SAM keeps getting asked
    // for it after the topic goes quiet — the zoom must not revert
    // mid-demo while the object is still at the face.
    if (held) {
      S.lastHeldLabel = held.label;
      S.lastHeldMs = now;
    }
    // Answer lift: the creator answering a reminder rolls again at once,
    // silently, so their words land in the file instead of the pause
    // eating them. Rule pauses stay strict; see Core.answerLift.
    if (S.sessionActive && S.mode === 'video' && Core.answerLift({
      latched: S.pauseGate.latched,
      recordPaused: S.recordPaused,
      speaking: (S.speakingCount || 0) > 0,
      echoQuiet: now >= S.suppressMicUntil,
      lastSpeechMs: S.lastUserSpeechMs,
      nowMs: now
    })) {
      S.lastUserSpeechMs = 0; // lift once per utterance
      S.pauseGate.releaseLatch();
      S.pauseGate.bad = 0;
      S.pauseGate.good = S.pauseGate.resumeAfter;
      S.pauseGate.paused = false;
      doResumeRecorder(true);
    }
    var focus = held || (S.sessionActive ? focusDetectionFor(active) : null);
    // Product-only zoom: a talked-about or held-up product frames itself
    // alone in the program output; the person keeps the gentle push-in.
    var productFill = !!(held || (focus && active && active !== 'person'));
    var z = S.zoom.update({ detection: focus, fill: productFill });
    var crop = S.zoom.getCrop(W, H);

    // Program = clean zoomed crop, copied BEFORE any overlay is drawn, so
    // guides, detection boxes, and status text are live-only: the recorded
    // video and saved photos never show them.
    gctx.fillStyle = '#000';
    gctx.fillRect(0, 0, W, H);
    gctx.drawImage(els.preview, crop.x, crop.y, crop.w, crop.h, 0, 0, W, H);

    // Live-only overlays on the preview: status text, guides, detections,
    // zoom frame. None of this reaches the program canvas above.
    if (!liveVideo) {
      pctx.fillStyle = '#9aa7b5';
      pctx.font = '15px sans-serif';
      pctx.fillText(els.simOn.checked ? 'Simulator mode — no camera needed' : 'Camera off — start camera or enable simulator', 18, H / 2);
    }
    drawGuides(pctx, W, H);
    drawDetections(pctx, W, H);
    if (z.zoom > 1.05 && S.zoom.focus) {
      pctx.strokeStyle = '#34c98e';
      pctx.lineWidth = 2;
      pctx.setLineDash([6, 4]);
      pctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
      pctx.setLineDash([]);
    }
    // REC badge on the preview only, after the program copy: never recorded.
    if (S.sessionActive) {
      var el = Date.now() - S.startMs;
      var mm = String(Math.floor(el / 60000)), ss = String(Math.floor(el / 1000) % 60);
      if (mm.length < 2) mm = '0' + mm;
      if (ss.length < 2) ss = '0' + ss;
      pctx.fillStyle = '#ef5350';
      pctx.beginPath();
      pctx.arc(18, 22, 7, 0, Math.PI * 2);
      pctx.fill();
      pctx.font = 'bold 14px sans-serif';
      pctx.fillText((S.mode === 'photo' ? 'PHOTO ' : 'REC ') + mm + ':' + ss, 30, 27);
    }
    // Gesture countdown, preview only: never recorded or photographed.
    if (S.sessionActive && S.shutter.captureAtMs) {
      pctx.fillStyle = '#f0b429';
      pctx.font = 'bold 72px sans-serif';
      pctx.textAlign = 'center';
      pctx.fillText(String(S.shutter.remainingSec(Date.now())), W / 2, H / 2 + 24);
      pctx.textAlign = 'start';
    }
    // Pause banner, preview only: the live view keeps playing by design, so
    // this is how a paused file LOOKS paused. Never recorded.
    if (S.recordPaused) {
      pctx.fillStyle = 'rgba(120, 20, 20, 0.88)';
      pctx.fillRect(0, 0, W, 34);
      pctx.fillStyle = '#ffffff';
      pctx.font = 'bold 17px sans-serif';
      pctx.textAlign = 'center';
      pctx.fillText('PAUSED — fix the shot to resume', W / 2, 23);
      pctx.textAlign = 'start';
    }

    els.pillZoom.textContent = 'Zoom: ' + z.zoom.toFixed(1) + 'x';
    els.pillZoom.className = 'pill' + (z.zoom > 1.2 ? ' warn' : '');
    els.pillTopic.textContent = 'Topic: ' + (active || '—');
    var nowMs = performance.now();
    if (nowMs - lastSampleMs > 500) { lastSampleMs = nowMs; sampleFrame(); }
    requestAnimationFrame(frameLoop);
  }

  // ---- Transcript -> agent ----
  // Spark second opinion: keywords cover the line instantly (and offline);
  // Spark refines with beats + a zoom focus when the proxy is live.
  function sparkReason(text) {
    if (!S.sessionActive || !S.model || !S.checklist) return;
    fetch('/api/reason', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ text: text, templateId: S.templateId, checklist: S.checklist.items })
    }).then(function (r) {
      if (r.status === 401) {
        demoBlocked('token');
        return null;
      }
      if (r.status === 429) {
        return noteApiBlock(r).then(function (err) {
          if (err === 'demo-paused') demoBlocked('paused');
          return null;
        });
      }
      return r.ok ? r.json() : null;
    }).then(function (res) {
      if (!res || !S.sessionActive) return;
      if (res.mentioned && res.mentioned.length) {
        var extra = S.checklist.processText(res.mentioned.join(', '), S.templateId);
        if (extra.length) {
          S.tracker.update(extra, Date.now());
          addLog('Spark heard: ' + extra.join(', '));
          renderChecklist();
        }
      }
      if (typeof res.focus === 'string' && res.focus) {
        var f = res.focus.toLowerCase();
        if (Core.findDetection(S.detections, f)) S.tracker.update([f], Date.now());
      }
    }).catch(function () { /* keyword path already covered this line */ });
  }

  function handleLine(text, source) {
    text = (text || '').trim();
    if (!text) return;
    addTranscript(text, source);
    var cmd = Core.parseRecordingCommand(text, S.mode || 'video');
    if (cmd === 'stop') {
      if (S.sessionActive) {
        addLog('Heard "stop" — ending the session.');
        stopSession();
      }
      return;
    }
    if (cmd === 'start') {
      if (S.sessionActive) {
        addLog('Heard "start" — already rolling.');
      } else if (!S.cameraOn && !els.simOn.checked) {
        addLog('Heard "start" — enable camera or simulator first.');
        speak('Start the camera or simulator first, then say start.');
      } else {
        addLog('Heard "start".');
        startSession();
      }
      return;
    }
    if (cmd === 'camera') {
      addLog('Heard "camera on" — starting the camera.');
      startCamera();
      return;
    }
    if (cmd === 'camera-off') {
      addLog('Heard "camera off" — stopping the camera.');
      stopCamera();
      return;
    }
    if (cmd === 'capture') {
      if (S.sessionActive && S.mode === 'photo') {
        var count = Core.parseCaptureCount(text);
        if (count && count > 1) burstCapture(count);
        else capturePhoto('voice');
      } else if (S.sessionActive && S.mode === 'video') {
        captureVideoSnapshot('voice');
      } else if (!S.sessionActive && Core.parseCaptureCount(text)) {
        setupUser(text);
      } else {
        addLog('Heard "capture" — no session is running.');
        speak('Start a session first, then ask for a photo.', 'answer');
      }
      return;
    }
    // Pre-session "looks good" (or a one-breath "looks good, I'm ready")
    // locks the checklist instead of running a look check — in-session
    // look questions are unaffected.
    if (!S.sessionActive && (Core.isApproval(text) || Core.parseLockReady(text))) {
      setupUser(text);
      return;
    }
    if (Core.isLookQuestion(text)) {
      var ans = lookAnswer();
      addLog('Look check: ' + ans);
      speak(ans);
      return;
    }
    // "What did I forget to say?" — spoken + logged, mid-session or after.
    if (Core.isForgotQuery(text)) {
      var missingNow = S.checklist.getMissing();
      var forgotAns = !S.checklist.items.length
        ? 'No checklist set for this session.'
        : missingNow.length
          ? 'You still have to say: ' + missingNow.join(', ') + '.'
          : 'All covered — nice work, nothing forgotten!';
      addLog('Forgot check: ' + forgotAns);
      speak(forgotAns);
      return;
    }
    // "I'm going to fetch X" pauses missing-you alerts; "I'm back" resumes.
    var awaySecs = Core.parseAwayNotice(text);
    if (awaySecs && S.sessionActive) {
      S.awayUntilMs = Date.now() + awaySecs * 1000;
      addLog('Away notice (' + awaySecs + 's) — pausing missing-you alerts.');
      speak('Okay, I will wait — say I am back when you return.');
    }
    if (Core.isBackNotice(text) && S.sessionActive) {
      S.awayUntilMs = 0;
      // "I'm back" unsticks honestly: drop any reminder latch, prime the
      // gate so one good tick resumes, and demand fresh eyes right now
      // instead of waiting for the next 4s poll.
      S.pauseGate.releaseLatch();
      if (S.recordPaused) {
        S.pauseGate.bad = 0;
        S.pauseGate.good = S.pauseGate.resumeAfter - 1;
        try { samPoll(); } catch (e) { /* next interval covers it */ }
      }
      addLog('Welcome back — watching the frame again.');
      speak('Welcome back.');
      return;
    }
    // Pre-session speech drives the setup chat ("I want to record…",
    // occasion, checklist, "I'm ready") — never the checklist directly.
    if (!S.sessionActive) {
      setupUser(text);
      return;
    }
    if (Core.isGreeting(text)) {
      var who = els.userName.value.trim();
      var gs = currentIssues({ skipBusy: true });
      var status = !gs.frame.person ? "I can't see you yet — step into the frame."
        : gs.out.length ? ('Quick note: ' + gs.out.slice(0, 2).join('; ') + '.')
        : 'Looking good — keep going.';
      var hello = 'Hey' + (who ? ', ' + who : '') + '! ' + status;
      addLog('Greeting: ' + hello);
      speak(hello, 'answer');
      return;
    }
    if (Core.isThanks(text)) {
      var ty = 'Anytime' + (els.userName.value.trim() ? ', ' + els.userName.value.trim() : '') + ' — looking good!';
      addLog('Thanks reply: ' + ty);
      speak(ty, 'answer');
      return;
    }
    var now = Date.now();
    if (Core.mentionsSelf(text)) S.selfTalkUntilMs = now + 15000;
    if (Core.isShowingContent(text)) {
      if (now >= S.showingUntilMs) addLog('Noted — showing the place; staying quiet about the frame.');
      S.showingUntilMs = now + 15000;
    }
    var missingBefore = S.pauseGate.latched ? S.checklist.getMissing().length : -1;
    var found = S.checklist.processText(text, S.templateId);
    // Said a forgotten beat while reminder-paused: lift the latch early so
    // the video resumes into the same file on the next ticks.
    if (missingBefore >= 0 && S.checklist.getMissing().length < missingBefore) {
      S.pauseGate.releaseLatch();
      addLog('Said it — reminder pause lifting.');
    }
    var res = S.tracker.update(found, now);
    // Only true when nothing is held: a held object keeps its zoom after
    // the topic goes quiet, so don't announce a zoom-out that won't happen.
    if (res.justCleared && !heldProductDetection()) {
      addLog('Topic quiet — zooming back out (' + res.justCleared + ').');
    }
    if (found.length) addLog('Heard topic: ' + found.join(', '));
    renderChecklist();
    sparkReason(text);
    tickAlerts(now);
  }

  els.btnSay.onclick = function () {
    handleLine(els.sayBox.value, 'typed');
    els.sayBox.value = '';
  };
  els.sayBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') els.btnSay.click();
  });

  // Birthday photos track a cake, never biryani — relabel frame wording.
  function displayIssueText(m) {
    if (S.mode === 'photo' && S.photoOccasion === 'birthday') return m.replace(/biryani dish/g, 'cake');
    return m;
  }

  // ---- Alerts + status ----
  function tickAlerts(now) {
    now = now || Date.now();
    var judgeId = S.mode === 'photo' ? photoJudgeId() : S.templateId;
    var frame = Core.analyzeFrame({ detections: S.detections, templateId: judgeId });
    var active = S.tracker.getActive(now);
    var topicVisible = true;
    if (active && Core.isVisualTopic(active)) {
      var canonical = active === 'dish' ? 'biryani' : active;
      topicVisible = Core.checkVisibility(S.detections, canonical).visible;
    }
    var recordingMs = S.sessionActive ? now - S.startMs : 0;
    var warming = S.sessionActive && !Core.visionReady(els.simOn.checked, S.cameraOn, !!S.model);
    var alerts = (S.sessionActive && !warming) ? S.alerts.decide({
      nowMs: now,
      frame: frame,
      activeTopic: active,
      topicVisible: topicVisible,
      recordingMs: recordingMs,
      userName: els.userName.value.trim() || 'Bhanu',
      checklistSkipped: S.checklist.getSkipped(),
      templateId: judgeId,
      awayUntilMs: S.awayUntilMs,
      selfTalking: personNeeded(now),
      proactiveFrame: S.mode === 'photo' && !S.tourMode
    }) : [];

    alerts.forEach(function (a) {
      S.alertsFired++;
      var shown = displayIssueText(a.text);
      // Skipped beats pause the video on the spot (same file, auto-resume
      // when said or after 30s) instead of only flashing a line.
      if (a.key === 'checklist' && S.sessionActive && S.mode === 'video' && S.recorder && S.recorder.state === 'recording') {
        var miss = S.checklist.getSkipped().slice(0, 3).join(', ');
        S.pauseGate.forcePause(Date.now() + 30000);
        addLog('Alert: ' + shown, 'alert');
        doPauseRecorder('you forgot to say: ' + miss);
        return;
      }
      addLog('Alert: ' + shown, 'alert');
      // Photo shoots are directed out loud: framing guidance speaks even in
      // quiet mode, since posing is silent and the shot depends on it.
      var kind = a.priority === 5 ? (S.mode === 'photo' ? 'issue' : 'hint') : 'issue';
      // A rule pause already spoke this fix — hold the voice, keep the log.
      var rulePaused = !!(S.pauseGate && S.pauseGate.paused && !S.pauseGate.latched);
      if (!Core.holdAlertVoice(a.key, rulePaused)) speak(shown, kind);
    });

    // Pills
    var personVisible = !!frame.person;
    els.pillFrame.textContent = 'Frame: ' + (frame.good ? 'Good' : 'Fix me');
    els.pillFrame.className = 'pill ' + (frame.good ? 'good' : 'bad');
    els.pillPerson.textContent = 'You: ' + (personVisible ? 'In frame' : 'Missing');
    els.pillPerson.className = 'pill ' + (personVisible ? 'good' : 'bad');
    var t = Core.getTemplate(S.templateId);
    if (t.primarySubject === 'person') {
      els.pillSubject.textContent = 'Subject: you';
      els.pillSubject.className = 'pill';
    } else {
      els.pillSubject.textContent = 'Subject: ' + (frame.subject ? 'Visible' : 'Missing');
      els.pillSubject.className = 'pill ' + (frame.subject ? 'good' : 'bad');
    }
    if (warming) {
      els.pillFrame.textContent = 'Frame: …';
      els.pillFrame.className = 'pill';
      els.pillPerson.textContent = 'You: …';
      els.pillPerson.className = 'pill';
      els.pillSubject.textContent = 'Subject: …';
      els.pillSubject.className = 'pill';
    }

    // Director line
    var line;
    var heldShown = S.sessionActive && !warming ? heldProductDetection() : null;
    if (!S.sessionActive) {
      line = 'Pick a template, start the camera or enable the simulator, then press “I\u2019m ready”.';
    } else if (warming) {
      line = 'Warming up the camera — hold on. If this sticks, tick "Simulate detections".';
    } else if (S.tokenWarned) {
      line = 'Demo link needs a valid token — add ?token=… to the URL.';
    } else if (S.pausedWarned) {
      line = 'Demo paused — daily limit reached. Try again tomorrow.';
    } else if (alerts.length) {
      line = alerts[0].text;
    } else if (frame.issues.length) {
      line = displayIssueText(frame.issues[0].message) + '.';
    } else if (heldShown) {
      line = 'Showing ' + heldShown.label + ' — zoomed in on it. Take it away and I zoom back out.';
    } else if (active && focusDetectionFor(active)) {
      line = 'Talking about ' + active + ' — zoomed in. Stay quiet on it and I zoom back out.';
    } else {
      line = 'Frame looks good. Keep going — I am watching the checklist.';
    }
    els.directorLine.textContent = line;
    updateRecordingPause(frame, active, now);
    return { frame: frame, alerts: alerts };
  }

  // Auto pause/resume: when the context needs someone/something on camera and
  // it is missing, pause the recorder so the saved file skips the dead air;
  // resume once everything needed is back in frame.
  function pauseReasonText(reason, t) {
    if (reason === 'subject') return t.primaryLabel + ' is not in frame — bring it back';
    if (reason === 'close') return 'you look cropped — step back a little';
    if (reason === 'half') return 'you are half out of frame — step fully into the shot';
    if (reason === 'light') {
      return S.light === 'dark' ? 'your face needs more light' : 'it is too bright';
    }
    return 'step back into the frame';
  }

  function doPauseRecorder(why) {
    if (!S.recorder || S.recorder.state !== 'recording') return false;
    try {
      S.recorder.pause();
    } catch (e) {
      addLog('Recording pause failed: ' + (e && e.message ? e.message : e), 'alert');
      return false;
    }
    S.recordPaused = true;
    addLog('Recording paused — ' + why + '. (recorder state: ' + S.recorder.state + ')', 'alert');
    speak('Recording paused — ' + why + '.', 'issue');
    els.topbar.classList.add('paused');
    els.sessionState.textContent = 'Paused — fix the shot';
    els.recStatus.textContent = 'Recording paused — ' + why + '…';
    return true;
  }

  // Resumes are always silent — no "recording again" voice. The banner
  // clearing plus this log line confirm it, takes stay free of chatter,
  // and a spoken resume would re-pause via speech-cut and eat answers.
  function doResumeRecorder(answerLift) {
    if (!S.recorder || S.recorder.state !== 'paused') return false;
    try {
      S.recorder.resume();
    } catch (e) {
      addLog('Recording resume failed: ' + (e && e.message ? e.message : e), 'alert');
      return false;
    }
    S.recordPaused = false;
    addLog(answerLift
      ? 'Heard you answering — rolling again so your words are saved. (recorder state: ' + S.recorder.state + ')'
      : 'Recording again — same file. (recorder state: ' + S.recorder.state + ')');
    els.topbar.classList.remove('paused');
    els.sessionState.textContent = 'Recording';
    els.recStatus.textContent = S.recHasAudio
      ? 'Recording program output + mic audio…'
      : 'Recording program output (video only — mic unavailable)…';
    return true;
  }

  function updateRecordingPause(frame, active, now) {
    if (!S.sessionActive || S.mode !== 'video' || !S.recorder) return;
    if (!Core.visionReady(els.simOn.checked, S.cameraOn, !!S.model)) return;
    // Reminder latch releases on timeout; saying the missing beats releases
    // it early from the transcript path.
    if (S.pauseGate.latched && now >= S.pauseGate.latchUntilMs) {
      S.pauseGate.releaseLatch();
      addLog('Reminder pause window over — resuming watch.');
    }
    var t = Core.getTemplate(S.templateId);
    var subjectTopic = active && (active === t.primarySubject || active === 'dish');
    var needs = Core.presenceNeeded(S.templateId, {
      selfTalking: now < S.selfTalkUntilMs,
      showing: S.tourMode || now < S.showingUntilMs,
      subjectTalked: !!subjectTopic
    });
    var codes = frame.issues.map(function (it) { return it.code; });
    // Light only counts on a real camera: the simulator canvas has no pixels
    // to judge, so it must never pause on light.
    var block = Core.recordingBlocked({
      userMissing: codes.indexOf('USER_MISSING') !== -1,
      subjectMissing: codes.some(function (c) { return c !== 'USER_MISSING' && /_MISSING$/.test(c); }),
      tooClose: codes.indexOf('PERSON_TOO_CLOSE') !== -1,
      halfOut: codes.indexOf('PERSON_HALF_OUT') !== -1,
      light: S.cameraOn ? S.light : 'good',
      needUser: needs.needUser,
      needSubject: needs.needSubject
    });
    var event = S.pauseGate.update(block.blocked);
    if (event === 'pause') {
      if (!doPauseRecorder(pauseReasonText(block.reasons[0], t))) {
        addLog('Pause wanted (' + (block.reasons[0] || 'shot') + ') but recorder is ' +
          (S.recorder ? S.recorder.state : 'missing') + ' — check the file after stop.', 'alert');
      }
    } else if (event === 'resume') {
      doResumeRecorder();
    }
  }

  setInterval(function () {
    if (S.sessionActive) {
      els.timer.textContent = fmtTime(Date.now() - S.startMs);
      tickAlerts();
    }
  }, 1000);

  // ---- Speech recognition ----
  function updateMicPill() {
    var map = {
      listening: ['Mic: Listening', 'good'],
      blocked: ['Mic: Blocked', 'bad'],
      off: ['Mic: Off', ''],
      error: ['Mic: Error', 'warn']
    };
    var cur = map[S.micState] || map.off;
    els.pillMic.textContent = cur[0];
    els.pillMic.className = 'pill' + (cur[1] ? ' ' + cur[1] : '');
  }

  function startListening() {
    if (!els.listenOn.checked || S.recognition) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      addLog('Mic speech-to-text not in this browser — use “Say it instead”.', 'alert');
      updateMicPill();
      return;
    }
    try {
      S.recognition = new SR();
      S.recognition.continuous = true;
      S.recognition.interimResults = true;
      S.recognition.lang = 'en-US';
      S.recogStats = { startMs: Date.now(), finals: 0, lastError: null };
      S.recognition.onresult = function (ev) {
        var interim = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) {
            var heard = ev.results[i][0].transcript || '';
            if (heard.trim().length < 2) continue; // mic noise blip, ignore
            // Any real final — even an echo-ignored one — proves the mic
            // hears, and clears the dead-mic watchdog below.
            if (S.recogStats) S.recogStats.finals++;
            S.micDeadStreak = 0;
            S.micDeadWarned = false;
            if (Date.now() < S.suppressMicUntil) {
              addTranscript('echo ignored: ' + heard.trim(), 'mic');
              continue;
            }
            if (S.lastSpokenText && Date.now() - S.lastSpokenMs < 12000 &&
                Core.isLikelyEcho(heard, S.lastSpokenText)) {
              addTranscript('echo ignored: ' + heard.trim(), 'mic');
              continue;
            }
            handleLine(heard, 'mic');
          } else {
            interim += ev.results[i][0].transcript;
          }
        }
        // Interim speech marks the creator talking RIGHT NOW (final results
        // arrive after they finish): reminder pauses lift on this so the
        // answer lands in the file. Gated at use, never trusted raw.
        if (interim.trim().length >= 2) S.lastUserSpeechMs = Date.now();
        els.hearingLine.textContent = interim.trim() ? 'Hearing: ' + interim.trim() : '';
      };
      S.recognition.onerror = function (ev) {
        if (S.recogStats) S.recogStats.lastError = (ev && ev.error) || null;
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          S.micState = 'blocked';
          updateMicPill();
          addLog('Mic blocked — click the lock icon in the address bar, allow Microphone, then press Enable mic.', 'alert');
        } else if (ev.error === 'network') {
          addLog('Mic network hiccup — retrying…');
        }
      };
      S.recognition.onend = function () {
        S.recognition = null;
        els.hearingLine.textContent = '';
        // Dead-mic watchdog: sessions churning with zero finals means the
        // mic hears nothing (grabbed by another app, device gone, net down)
        // — say so once instead of staying silently deaf. Quiet sessions
        // never count; any heard final already cleared the streak above.
        if (S.recogStats && S.micState === 'listening' && Core.micSessionBarren({
          finals: S.recogStats.finals,
          lastError: S.recogStats.lastError,
          elapsedMs: Date.now() - S.recogStats.startMs
        })) {
          S.micDeadStreak = (S.micDeadStreak || 0) + 1;
        } else {
          S.micDeadStreak = 0;
        }
        if (S.micDeadStreak >= 4 && !S.micDeadWarned) {
          S.micDeadWarned = true;
          addLog('Mic hears nothing — check your connection, and that no other app grabbed the microphone.', 'alert');
          speak('I can not hear anything from the mic — check your connection, and that no other app grabbed the microphone.', 'issue');
        }
        if (els.listenOn.checked) {
          setTimeout(startListening, 800);
        } else {
          S.micState = 'off';
          updateMicPill();
        }
      };
      S.recognition.start();
      S.micState = 'listening';
      updateMicPill();
      addLog('Listening to mic…');
    } catch (e) {
      S.recognition = null;
      S.micState = 'error';
      updateMicPill();
      addLog('Could not start mic listening — type instead.', 'alert');
    }
  }

  // One shared mic stream for the whole page: held (never stopped) so the
  // recorder can mix voice into the video while speech recognition listens.
  function ensureMicStream() {
    var live = S.micStream ? Core.liveTracks(S.micStream.getAudioTracks()) : [];
    if (live.length) return Promise.resolve(S.micStream);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('no-mic'));
    }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      S.micStream = stream;
      return stream;
    });
  }

  els.btnMic.onclick = function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      S.micState = 'blocked';
      updateMicPill();
      addLog('Mic unavailable in this browser — type instead.', 'alert');
      return;
    }
    addLog('Requesting mic permission…');
    ensureMicStream().then(function () {
      setupAudioGraph(); // inside the click's gesture window: graph can start running
      els.listenOn.checked = true;
      S.micState = 'listening';
      updateMicPill();
      addLog('Mic enabled — talk, and watch the Hearing line.');
      startListening();
    }).catch(function (err) {
      S.micState = 'blocked';
      updateMicPill();
      addLog('Mic blocked (' + (err && err.name || 'denied') + '). Click the lock icon in the address bar → allow Microphone → press Enable mic again.', 'alert');
    });
  };

  function stopListening() {
    try { if (S.recognition) S.recognition.stop(); } catch (e) {}
    S.recognition = null;
    S.micState = 'off';
    updateMicPill();
  }

  // ---- Photo captures ----
  function renderBest() {
    els.photoBest.textContent = S.photoCount
      ? 'Best: #' + S.bestNum + ' (score ' + S.bestScore + ')'
      : 'No photos yet';
    els.photoStrip.innerHTML = '';
    S.shots.forEach(function (sh) {
      var d = document.createElement('div');
      d.className = 'shot' + (sh.num === S.bestNum ? ' best' : '');
      var img = document.createElement('img');
      img.src = sh.url;
      img.alt = 'Photo ' + sh.num;
      var meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = (sh.num === S.bestNum ? 'Best ' : '') + '#' + sh.num + ' · score ' + sh.score + ' · ' + sh.via;
      var row = document.createElement('div');
      row.className = 'row';
      var dl = document.createElement('a');
      dl.href = sh.url;
      dl.download = 'solo-photo-' + sh.num + '.jpg';
      dl.textContent = 'Save';
      var del = document.createElement('button');
      del.textContent = 'Delete';
      del.onclick = (function (n) {
        return function () {
          S.shots = S.shots.filter(function (x) { return x.num !== n; });
          S.bestScore = -1;
          S.bestNum = 0;
          S.shots.forEach(function (x) {
            if (x.score > S.bestScore) { S.bestScore = x.score; S.bestNum = x.num; }
          });
          addLog('Deleted photo #' + n + '.');
          renderBest();
        };
      })(sh.num);
      row.appendChild(dl);
      row.appendChild(del);
      d.appendChild(img);
      d.appendChild(meta);
      d.appendChild(row);
      els.photoStrip.appendChild(d);
    });
  }

  function scoreCurrentFrame(judgeId) {
    var frame = Core.analyzeFrame({ detections: S.detections, templateId: judgeId });
    var score = Core.scorePhoto({
      personVisible: !!frame.person,
      centerOffset: frame.person ? Math.abs(frame.person.bbox[0] + frame.person.bbox[2] / 2 - 0.5) : 1,
      area: frame.person ? frame.person.bbox[2] * frame.person.bbox[3] : 0,
      brightness: S.lightMean != null ? S.lightMean : 120,
      motion: S.motionRatio || 0
    });
    return { frame: frame, score: score };
  }

  function capturePhoto(via) {
    if (!S.sessionActive || S.mode !== 'photo') return;
    // Required-subject gate: no cake, no birthday photo. Only enforced on
    // fresh detections — blind/stale vision stays permissive.
    var needNoun = Core.photoRequiredNoun(S.photoOccasion, S.photoSubject);
    var freshDet = Date.now() - (S.lastSamOkMs || 0) < 6000;
    if (needNoun && freshDet && !Core.findDetection(S.detections, needNoun)) {
      var needMsg = needNoun === 'person'
        ? "I can't see you — step into the frame first, then say capture."
        : 'No ' + needNoun + ' in frame — bring it in first, then say capture.';
      addLog('Capture held — ' + needNoun + ' is not in frame.', 'alert');
      speak(needMsg, 'answer');
      return;
    }
    var judge = S.photoOccasion === 'birthday' ? 'recipe' : 'vlog';
    var judged = scoreCurrentFrame(judge);
    var frame = judged.frame, score = judged.score;
    S.photoCount++;
    var url = els.program.toDataURL('image/jpeg', 0.85);
    S.shots.push({ num: S.photoCount, url: url, score: score, via: via });
    var cap = S.checklist.items.filter(function (it) { return /captur/i.test(it); })[0];
    if (cap) S.checklist.mentioned[String(cap).toLowerCase()] = true;
    renderChecklist();
    addLog('Captured photo #' + S.photoCount + ' (' + via + ', score ' + score + ').');
    var v = Core.captureVerdict(score, !!frame.person);
    var isBest = score > S.bestScore;
    if (isBest) {
      S.bestScore = score;
      S.bestNum = S.photoCount;
    }
    if (!v.ok) {
      var who = els.userName.value.trim() || 'Bhanu';
      addLog('Quality: that shot is not clearly visible.', 'alert');
      speak(who + ', that one is not clearly visible — come into the frame and take it again.');
    } else if (isBest) {
      speak('Captured — new best photo, number ' + S.photoCount + '.', 'routine');
    } else {
      speak('Captured photo ' + S.photoCount + '.', 'routine');
    }
    renderBest();
  }

  // Video sessions: "take a photo" saves a scored still into the strip below
  // (no auto-download, so a stray misfire is just one more thumbnail).
  function captureVideoSnapshot(via) {
    if (!S.sessionActive || S.mode !== 'video') return;
    var judged = scoreCurrentFrame(S.templateId);
    var frame = judged.frame, score = judged.score;
    S.photoCount++;
    S.shots.push({ num: S.photoCount, url: els.program.toDataURL('image/jpeg', 0.85), score: score, via: via });
    var isBest = score > S.bestScore;
    if (isBest) {
      S.bestScore = score;
      S.bestNum = S.photoCount;
    }
    els.photoPanel.style.display = '';
    renderBest();
    addLog('Snapshot #' + S.photoCount + ' saved below (' + via + ', score ' + score + ').');
    var v = Core.captureVerdict(score, !!frame.person);
    if (!v.ok) speak('Snapshot saved, but it is not clearly visible.', 'answer');
    else if (isBest) speak('Snapshot saved — new best.', 'answer');
    else speak('Snapshot saved.', 'answer');
  }

  els.btnCapture.onclick = function () {
    if (!S.sessionActive) {
      addLog('Start a session first, then capture.', 'alert');
      return;
    }
    if (S.mode === 'photo') capturePhoto('button');
    else captureVideoSnapshot('button');
  };

  function burstCapture(n) {
    n = Math.max(1, Math.min(10, n || 5));
    if (!S.sessionActive || S.mode !== 'photo' || S.bursting) return;
    S.bursting = true;
    addLog('Burst: capturing ' + n + ' photos…');
    speak('Capturing ' + n + ' photos.');
    for (var i = 0; i < n; i++) {
      setTimeout(function () {
        if (S.sessionActive && S.mode === 'photo') capturePhoto('burst');
      }, i * 600);
    }
    setTimeout(function () { S.bursting = false; }, n * 600 + 200);
  }
  els.btnBurst.onclick = function () { burstCapture(5); };

  function downloadShot(sh) {
    var a = document.createElement('a');
    a.href = sh.url;
    a.download = 'solo-photo-' + sh.num + (sh.num === S.bestNum ? '-best' : '') + '.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  els.btnSaveBest.onclick = function () {
    var best = null;
    S.shots.forEach(function (x) { if (x.num === S.bestNum) best = x; });
    if (!best) {
      addLog('No photos yet — capture first, then save the best.', 'alert');
      return;
    }
    downloadShot(best);
    addLog('Saved best photo (#' + best.num + ', score ' + best.score + ').');
  };

  els.btnSaveAll.onclick = function () {
    if (!S.shots.length) {
      addLog('No photos yet — nothing to save.', 'alert');
      return;
    }
    S.shots.forEach(function (sh, i) {
      setTimeout(function () { downloadShot(sh); }, i * 350);
    });
    addLog('Saving all ' + S.shots.length + ' photos (best is #' + S.bestNum + ').');
  };

  // ---- Recording ----
  function startRecorder() {
    var canvasStream;
    try {
      canvasStream = els.program.captureStream(30);
    } catch (e) {
      els.recStatus.textContent = 'Recording not supported in this browser — live direction still works.';
      return;
    }
    els.recStatus.textContent = 'Starting recording…';
    // Tracks must be present before MediaRecorder is built, so the mic is
    // resolved first; a blocked mic falls back to video-only.
    ensureMicStream().then(function () {
      setupAudioGraph();
      beginRecording(canvasStream, recorderAudioTracks());
    }).catch(function () {
      addLog('Mic unavailable for recording — saving video only.', 'alert');
      beginRecording(canvasStream, []);
    });
  }

  function beginRecording(canvasStream, audioTracks) {
    // Stopped while the mic prompt was open: stay stopped.
    if (!S.sessionActive || S.mode !== 'video') return;
    try {
      var tracks = Core.liveTracks(canvasStream.getVideoTracks()).concat(audioTracks || []);
      var stream = tracks.length ? new MediaStream(tracks) : canvasStream;
      var mime = Core.pickRecorderMime(function (m) {
        return !!(window.MediaRecorder && MediaRecorder.isTypeSupported(m));
      });
      S.chunks = [];
      S.recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 })
        : new MediaRecorder(stream, { videoBitsPerSecond: 2500000 });
      S.recorder.ondataavailable = function (ev) { if (ev.data.size) S.chunks.push(ev.data); };
      S.recorder.onstop = function () {
        var blob = new Blob(S.chunks, { type: 'video/webm' });
        var url = URL.createObjectURL(blob);
        els.download.href = url;
        els.download.download = 'solo-cameraman-' + S.templateId + '.webm';
        els.download.style.display = 'inline';
        els.download.className = 'btn';
        els.download.textContent = 'Save video (.webm, ' + Math.round(blob.size / 1024) + ' KB)';
        els.recStatus.textContent = 'Recording saved (' + Math.round(blob.size / 1024) + ' KB) — press Save video below.';
      };
      S.recorder.start(1000);
      if (S.audioCtx && S.audioCtx.state === 'running' && S.graphStream === S.micStream) {
        addLog('Mic graph running — my voice stays out of your video.');
      } else if (audioTracks && audioTracks.length) {
        addLog('Mic graph idle — recording raw mic, muted while I speak so my voice stays out of your video.');
      }
      S.recHasAudio = !!(audioTracks && audioTracks.length);
      els.recStatus.textContent = S.recHasAudio
        ? 'Recording program output + mic audio…'
        : 'Recording program output (video only — mic unavailable)…';
    } catch (e) {
      els.recStatus.textContent = 'Recording not supported in this browser — live direction still works.';
    }
  }

  // ---- Session ----
  function startSession() {
    // Never stack two recorders: a second start while rolling would orphan
    // the first MediaRecorder and corrupt the file's audio/video interleave.
    if (S.sessionActive) {
      addLog('Already rolling — press Stop, then start again for a fresh take.');
      return;
    }
    // Checklist check-in first: nothing rolls until you lock the list with
    // "looks good" (voice, chip, or typed) after any occasion/template change.
    if (!S.checklistConfirmed) {
      nudgeChecklistLock();
      return;
    }
    var items = parseChecklistEdit();
    if (!items.length) items = Core.checklistForTemplate(S.templateId);
    S.checklist = new Core.ContentChecklist(items);
    S.tracker = new Core.TopicTracker();
    S.zoom = new Core.ZoomController();
    S.alerts = new Core.AlertManager();
    S.shutter = new Core.GestureShutter();
    S.wave = new Core.HandWave();
    S.pauseGate = new Core.RecordingPause();
    S.alertsFired = 0;
    S.awayUntilMs = 0;
    S.selfTalkUntilMs = 0;
    S.lastHeldLabel = null;
    S.lastHeldMs = 0;
    S.chunks = [];
    S.startMs = Date.now();
    S.sessionActive = true;
    els.download.style.display = 'none';
    els.topbar.classList.add('recording');
    els.topbar.classList.remove('paused');
    els.preview.classList.add('rec');
    S.photoCount = 0;
    S.shots = [];
    S.bestScore = -1;
    S.bestNum = 0;
    renderBest();
    els.photoPanel.style.display = S.mode === 'photo' ? '' : 'none';
    els.sessionState.textContent = S.mode === 'photo' ? 'Photo live' : 'Recording';
    els.btnReady.disabled = true;
    els.btnStop.disabled = false;
    renderChecklist();
    startListening();
    var t = Core.getTemplate(S.templateId);
    var name = els.userName.value.trim() || 'Bhanu';
    var preMsg;
    if (!Core.visionReady(els.simOn.checked, S.cameraOn, !!S.model)) {
      preMsg = ' Camera is warming up — I will start watching in a moment.';
    } else {
      var pre = currentIssues({ skipBusy: true });
      preMsg = pre.out.length
        ? ' Quick check: ' + pre.out.slice(0, 2).join('; ') + ' — I will keep watching.'
        : ' All checks passed.';
    }
    if (S.mode === 'photo') {
      els.recStatus.textContent = 'Photo session — say “capture” or press Capture.'
      addLog('Session started: photo (' + (S.photoOccasion || 'custom') + ') — “' + (els.occasion.value.trim() || 'untitled') + '”.');
      speak('Photo session started, ' + name + '.' + preMsg +
        (S.requestedShots ? ' You wanted ' + S.requestedShots + ' photos — tell me how many any time, or say the word for one at a time.' : ' Say the word when ready.'));
    } else {
      addLog('Session started: ' + t.label + ' — “' + (els.occasion.value.trim() || 'untitled video') + '”.');
      // The file starts when you start: the recorder rolls only after the
      // opening voice finishes, so the intro is cut from the video too —
      // not just muted out of the audio.
      els.recStatus.textContent = 'Starting recording after the intro…';
      speak('Recording started, ' + name + '.' + preMsg, undefined, function () {
        if (!S.sessionActive || S.mode !== 'video') return;
        startRecorder();
      });
    }
    tickAlerts();
  }
  els.btnReady.onclick = startSession;

  function stopSession() {
    S.sessionActive = false;
    S.bursting = false;
    S.checklistConfirmed = false;
    S.recordPaused = false;
    S.shutter.reset();
    setMicTrackEnabled(true);
    try {
      if (S.recorder && S.recorder.state === 'paused') S.recorder.resume();
      if (S.recorder && S.recorder.state !== 'inactive') S.recorder.stop();
    } catch (e) {}
    S.recorder = null;
    // Stopped during the opening voice: the recorder never rolled, so say so
    // instead of leaving the "starting after the intro" status up.
    if (S.mode === 'video' && !S.chunks.length) {
      els.recStatus.textContent = 'No recording — stopped before the intro finished.';
    }
    els.topbar.classList.remove('recording');
    els.topbar.classList.remove('paused');
    els.preview.classList.remove('rec');
    els.sessionState.textContent = 'Finished';
    refreshReady();
    els.btnStop.disabled = true;
    if (S.mode === 'photo') {
      addLog('Photo session stopped. ' + S.photoCount + ' photo(s)' +
        (S.bestNum ? ', best is #' + S.bestNum + ' (score ' + S.bestScore + ').' : '.'));
      speak('Photo session stopped.' + (S.bestNum ? ' Best photo is number ' + S.bestNum + '.' : ''));
    } else {
      var got = S.checklist.getMentioned().length, total = S.checklist.items.length;
      var missing = S.checklist.getMissing();
      var orderNote = S.checklist.getOrderNote();
      addLog(total
        ? 'Session stopped. Coverage ' + got + '/' + total +
          (missing.length ? '. Still missing: ' + missing.join(', ') : '. All beats covered!') +
          (orderNote ? ' Order: ' + orderNote + '.' : '')
        : 'Session stopped. No checklist this time.');
      speak(total
        ? 'Session stopped. You covered ' + got + ' of ' + total + ' checklist items.' +
          (missing.length ? ' You forgot to say: ' + missing.join(', ') + '.' : '') +
          (orderNote ? ' ' + orderNote + '.' : '') + ' Your video is ready below — press Save video.'
        : 'Session stopped. No checklist this time — your video is ready below — press Save video.');
    }
    setupSay('agent', 'Say a new occasion any time — or "new session" — and I will switch the checklist for the next round.');
    tickAlerts();
  }
  els.btnStop.onclick = stopSession;

  els.btnTestVoice.onclick = function () {
    var t = Core.getTemplate(S.templateId);
    var name = els.userName.value.trim() || 'Bhanu';
    speak(name + ', ' + t.primaryLabel + ' is not visible in the frame');
  };

  // Simple demo view: same app, only the talk panel, cameras, director,
  // and checklist stay visible. Judges open the demo link with
  // ?view=simple; the topbar button flips back any time.
  function setSimpleView(on) {
    document.body.classList.toggle('simple', !!on);
    els.btnView.textContent = on ? 'Full view' : 'Simple view';
    // Step numbers belong to the full setup flow ("1 ·" is hidden here),
    // so drop them in simple view and restore them going back.
    Array.prototype.forEach.call(document.querySelectorAll('main h2'), function (h) {
      if (on) {
        if (!h.dataset.full) h.dataset.full = h.textContent;
        h.textContent = h.textContent.replace(/^[123] · /, '');
      } else if (h.dataset.full) {
        h.textContent = h.dataset.full;
      }
    });
  }
  els.btnView.onclick = function () {
    setSimpleView(!document.body.classList.contains('simple'));
  };
  try {
    if (new URLSearchParams(location.search).get('view') === 'simple') setSimpleView(true);
  } catch (e) { /* full view stays */ }

  // Welcome first screen: Start reveals the app and hands focus to Talk.
  els.btnWelcomeStart.onclick = function () {
    document.body.classList.add('welcomed');
    try { els.btnTalk.focus(); } catch (e) { /* focus is a nicety */ }
  };

  // ---- Simple voice panel ----
  els.btnTalk.onclick = function () {
    // Talk always opens the mic, never mutes it (muting lives on the
    // "Listen to mic" checkbox). Log-only confirm: speaking here would
    // deafen the mic just as the user starts talking.
    if (Core.talkAction(S.micState) === 'confirm') {
      addLog('Mic is already listening — go ahead, I hear you.');
    } else {
      els.btnMic.click();
    }
  };
  els.btnSimpleCamera.onclick = toggleCamera;
  els.btnSimpleReady.onclick = function () {
    if (S.sessionActive) return;
    if (!S.cameraOn && !els.simOn.checked) {
      setupAgent('Almost — start the camera or tick "Simulate detections" first, then say "I\'m ready".');
      return;
    }
    startSession();
  };
  els.btnSimpleCapture.onclick = function () { els.btnCapture.click(); };
  els.btnSimpleStop.onclick = function () {
    if (S.sessionActive) stopSession();
    else addLog('Nothing to stop — no session is running.');
  };

  // ---- Init ----
  els.checklistEdit.value = Core.checklistForTemplate('recipe').join(', ');
  renderTemplates();
  renderChecklist();
  refreshReady();
  setupSay('agent', 'Hi! What can I do for you?');
  setupChips(SETUP_CHIPS.start);
  updateModeUI();
  els.listenOn.addEventListener('change', function () {
    if (els.listenOn.checked) startListening();
    else stopListening();
  });
  els.voiceMode.addEventListener('change', function () {
    S.voiceMode = els.voiceMode.value === 'full' ? 'full' : 'quiet';
    addLog('Voice mode: ' + S.voiceMode + '.');
  });
  // Any tap revives a suspended mic graph (browsers only let audio start
  // on user gestures), so later sessions keep voice muting.
  document.addEventListener('pointerdown', function () {
    if (S.audioCtx && S.audioCtx.state === 'suspended') S.audioCtx.resume().catch(function () {});
  }, { passive: true });
  startListening();
  addLog('Ready (build ' + APP_BUILD + '). Tip: online Chrome/Edge gives mic + detector; otherwise use simulator + typing.');
  requestAnimationFrame(frameLoop);
  // Friendly cameraman greets first (best effort — some browsers need a tap
  // before any voice; the mic always needs Talk for permission).
  speak('Hi! I am your cameraman. Tap Talk, then tell me — photos or a video?', 'setup');
})();
