/* Maintained tests for the Solo Cameraman agent core.
   Run: npm test   (from the solo-cameraman folder) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../agent-core.js');

const person = (x = 0.37) => ({ label: 'person', score: 0.9, bbox: [x, 0.2, 0.26, 0.55] });
const bowl = () => ({ label: 'bowl', score: 0.85, bbox: [0.62, 0.55, 0.22, 0.3] });
const bottle = () => ({ label: 'bottle', score: 0.88, bbox: [0.6, 0.5, 0.2, 0.32] });

test('recipe mentions: visual topic sorts first', () => {
  const found = Core.findMentions('Now I add the onions to the biryani', 'recipe');
  assert.ok(found.includes('biryani'));
  assert.ok(found.includes('onion'));
  assert.equal(found[0], 'biryani');
});

test('recipe checklist tracks mentions and missing', () => {
  const c = new Core.ContentChecklist(Core.checklistForTemplate('recipe'));
  c.processText('first the basmati rice and sliced onions', 'recipe');
  c.processText('add curd and salt', 'recipe');
  assert.ok(c.getMentioned().includes('rice'));
  assert.ok(c.getMentioned().includes('onion'));
  assert.ok(c.getMentioned().includes('yogurt'));
  assert.ok(c.getMissing().includes('chicken'));
  assert.ok(c.getCoverage() > 0 && c.getCoverage() < 1);
});

test('vlog frame: person is enough, dish not required', () => {
  const good = Core.analyzeFrame({ detections: [person()], templateId: 'vlog' });
  assert.equal(good.good, true);
  const missing = Core.analyzeFrame({ detections: [bowl()], templateId: 'vlog' });
  assert.ok(missing.issues.some((i) => i.code === 'USER_MISSING'));
  assert.ok(!missing.issues.some((i) => i.code === 'DISH_MISSING'));
});

test('recipe frame: missing dish blocks a good frame', () => {
  const f = Core.analyzeFrame({ detections: [person()], templateId: 'recipe' });
  assert.equal(f.good, false);
  assert.ok(f.issues.some((i) => i.code === 'DISH_MISSING'));
  const ok = Core.analyzeFrame({ detections: [person(), bowl()], templateId: 'recipe' });
  assert.equal(ok.good, true);
});

test('frame judge: too-small and too-close person codes', () => {
  const small = Core.analyzeFrame({
    detections: [{ label: 'person', score: 0.9, bbox: [0.4, 0.3, 0.1, 0.15] }],
    templateId: 'vlog'
  });
  assert.ok(small.issues.some((i) => i.code === 'PERSON_TOO_SMALL'));
  const close = Core.analyzeFrame({
    detections: [{ label: 'person', score: 0.9, bbox: [0.05, 0.05, 0.9, 0.9] }],
    templateId: 'vlog'
  });
  assert.ok(close.issues.some((i) => i.code === 'PERSON_TOO_CLOSE'));
});

test('product frame: product label counts as visible subject', () => {
  const missing = Core.analyzeFrame({ detections: [person()], templateId: 'product' });
  assert.ok(missing.issues.some((i) => i.code === 'PRODUCT_MISSING'));
  const ok = Core.analyzeFrame({ detections: [person(), bottle()], templateId: 'product' });
  assert.equal(ok.good, true);
});

test('topic tracker holds then releases for zoom-out', () => {
  const t = new Core.TopicTracker();
  assert.equal(t.update(['biryani'], 0).active, 'biryani');
  assert.equal(t.update([], Core.TOPIC_TIMEOUT_MS - 1).active, 'biryani');
  const done = t.update([], Core.TOPIC_TIMEOUT_MS + 1);
  assert.equal(done.active, null);
  assert.equal(done.justCleared, 'biryani');
});

test('zoom: pushes in on visible topic, relaxes when quiet', () => {
  const z = new Core.ZoomController();
  for (let i = 0; i < 30; i++) z.update({ detection: bowl() });
  assert.ok(z.zoom > 1.2, 'expected zoom-in, got ' + z.zoom);
  const crop = z.getCrop(640, 360);
  assert.ok(crop.w < 640 && crop.h < 360);
  for (let i = 0; i < 60; i++) z.update({ detection: null });
  assert.ok(z.zoom < 1.1, 'expected zoom-out, got ' + z.zoom);
  assert.equal(z.getCrop(640, 360).w, 640);
});

test('alerts: user-missing fires once per cooldown, needs brief persistence', () => {
  const a = new Core.AlertManager();
  const frame = { issues: [{ code: 'USER_MISSING' }] };
  const base = { frame, recordingMs: 5000, nowMs: 10000, userName: 'Bhanu', templateId: 'vlog', selfTalking: true };
  assert.equal(a.decide(base).length, 0); // first sighting only arms
  assert.equal(a.decide({ ...base, nowMs: 10000 + 1000 }).length, 0); // needs ~2s steady
  const fired = a.decide({ ...base, nowMs: 10000 + 2100 });
  assert.equal(fired.length, 1);
  assert.match(fired[0].text, /missing from the frame/);
  assert.equal(a.decide({ ...base, nowMs: 10000 + 2200 }).length, 0); // cooldown
});

test('alerts: talked-about dish missing warns by name', () => {
  const a = new Core.AlertManager();
  const frame = { issues: [{ code: 'DISH_MISSING' }], templateId: 'recipe' };
  const base = {
    frame, activeTopic: 'biryani', topicVisible: false,
    recordingMs: 8000, nowMs: 5000, userName: 'Bhanu', templateId: 'recipe'
  };
  a.decide(base);
  const fired = a.decide({ ...base, nowMs: 5000 + 3100 });
  assert.equal(fired.length, 1);
  assert.match(fired[0].text, /biryani dish is not visible/);
});

test('alerts: subject-missing fires once with one wording (no duplicate)', () => {
  const a = new Core.AlertManager();
  const frame = { issues: [{ code: 'DISH_MISSING' }], templateId: 'recipe' };
  const base = {
    frame, activeTopic: 'biryani', topicVisible: false,
    recordingMs: 8000, nowMs: 5000, userName: 'Bhanu', templateId: 'recipe'
  };
  const seen = [];
  for (let t = 5000; t <= 15000; t += 1000) {
    a.decide({ ...base, nowMs: t }).forEach((al) => seen.push(al.text));
  }
  assert.equal(seen.length, 1);
  assert.match(seen[0], /biryani dish is not visible/);
});

test('alerts: checklist-only topics never trigger missing alerts', () => {
  const a = new Core.AlertManager();
  const out = a.decide({
    frame: { issues: [] }, activeTopic: 'rice', topicVisible: false,
    recordingMs: 8000, nowMs: 5000, userName: 'Bhanu',
    checklistMissing: [], templateId: 'recipe'
  });
  assert.equal(out.length, 0);
});

test('alerts: late recipe reminder names skipped ingredients', () => {
  const a = new Core.AlertManager();
  const out = a.decide({
    frame: { issues: [] }, recordingMs: 60000, nowMs: 70000,
    userName: 'Bhanu', checklistSkipped: ['salt', 'water'], templateId: 'recipe'
  });
  assert.equal(out.length, 1);
  assert.match(out[0].text, /ingredients/);
  assert.match(out[0].text, /salt/);
});

test('alerts: unreached beats never nag mid-take, skipped beats do', () => {
  const a = new Core.AlertManager();
  const base = { frame: { issues: [] }, recordingMs: 60000, nowMs: 70000, userName: 'Bhanu', templateId: 'vlog' };
  assert.equal(a.decide(Object.assign({}, base, { checklistSkipped: [] })).length, 0); // outro still ahead: silence
  const out = a.decide(Object.assign({}, base, { checklistSkipped: ['story'] })); // jumped over it: nag
  assert.equal(out.length, 1);
  assert.match(out[0].text, /story/);
});

test('alerts: framing hint is lowest priority and single', () => {
  const a = new Core.AlertManager();
  const base = {
    frame: { issues: [{ code: 'PERSON_OFF_CENTER' }] },
    recordingMs: 9000, userName: 'Bhanu',
    checklistMissing: [], templateId: 'vlog'
  };
  assert.equal(a.decide({ ...base, nowMs: 9000 }).length, 0); // first sighting arms
  const out = a.decide({ ...base, nowMs: 10100 });
  assert.equal(out.length, 1);
  assert.match(out[0].text, /center/);
  assert.equal(a.decide({ ...base, nowMs: 31000 }).length, 0); // no 20s repeat nag
});

test('alerts say missing once per episode, re-arm after steady clear', () => {
  const a = new Core.AlertManager();
  const frame = { issues: [{ code: 'USER_MISSING' }] };
  const base = { frame, recordingMs: 5000, userName: 'Bhanu', templateId: 'vlog', selfTalking: true };
  a.decide({ ...base, nowMs: 1000 });
  assert.equal(a.decide({ ...base, nowMs: 6200 }).length, 1);
  assert.equal(a.decide({ ...base, nowMs: 12000 }).length, 0);
  assert.equal(a.decide({ ...base, nowMs: 25000 }).length, 0);
  const clear = { issues: [] };
  a.decide({ ...base, frame: clear, nowMs: 26000 });
  a.decide({ ...base, frame: clear, nowMs: 31000 });
  a.decide({ ...base, nowMs: 32000 });
  assert.equal(a.decide({ ...base, nowMs: 37500 }).length, 1);
});

test('topic missing speaks once until the topic changes', () => {
  const a = new Core.AlertManager();
  const base = {
    frame: { issues: [] }, topicVisible: false,
    recordingMs: 8000, userName: 'Bhanu',
    checklistMissing: [], templateId: 'vlog'
  };
  assert.equal(a.decide({ ...base, activeTopic: 'product', nowMs: 5000 }).length, 0);
  assert.equal(a.decide({ ...base, activeTopic: 'product', nowMs: 6000 }).length, 1);
  assert.equal(a.decide({ ...base, activeTopic: 'product', nowMs: 16000 }).length, 0);
  assert.equal(a.decide({ ...base, activeTopic: 'handbag', nowMs: 17000 }).length, 0);
  assert.equal(a.decide({ ...base, activeTopic: 'handbag', nowMs: 18000 }).length, 1);
});

test('talk button enables the mic, never mutes it', () => {
  assert.equal(Core.talkAction('listening'), 'confirm');
  assert.equal(Core.talkAction('off'), 'enable');
  assert.equal(Core.talkAction('blocked'), 'enable');
  assert.equal(Core.talkAction(''), 'enable');
});

test('greetings and thanks get friendly replies, vlog intros do not', () => {
  assert.equal(Core.isGreeting('hi'), true);
  assert.equal(Core.isGreeting('Hello!'), true);
  assert.equal(Core.isGreeting('hey'), true);
  assert.equal(Core.isGreeting('namaste'), true);
  assert.equal(Core.isGreeting('add the onions now'), false);
  assert.equal(Core.isGreeting('welcome to my channel'), false);
  assert.equal(Core.isThanks('thank you'), true);
  assert.equal(Core.isThanks('thanks!'), true);
  assert.equal(Core.isThanks('welcome to my channel'), false);
  assert.equal(Core.isThanks('okay sure'), false);
});

test('hand wave fires on an entering hand, ignores ambient drift', () => {
  const w = new Core.HandWave();
  assert.equal(w.update([0.02, 0.03, 0.01], 0), false); // baseline
  assert.equal(w.update([0.02, 0.14, 0.01], 500), false); // first hot tick arms
  assert.equal(w.update([0.02, 0.23, 0.01], 1000), true); // still rising: wave!
  assert.equal(w.update([0.02, 0.23, 0.01], 1500), false); // latched while held
  assert.equal(w.update([0.30, 0.23, 0.01], 2000), false); // still latched
  assert.equal(w.update([0.02, 0.03, 0.01], 9500), false); // latch expired, calm
  assert.equal(w.update([0.02, 0.14, 0.01], 10000), false); // arms again
  assert.equal(w.update([0.02, 0.23, 0.01], 10500), true);
});

test('hand wave ignores constant skin and slow drift', () => {
  const w = new Core.HandWave();
  assert.equal(w.update([0.11, 0.02, 0.01], 0), false); // baseline (wood-like)
  assert.equal(w.update([0.11, 0.02, 0.01], 500), false); // no jump, below absolute
  assert.equal(w.update([0.12, 0.03, 0.02], 1000), false); // drift, no jump
});

test('showing intent and tour sessions relax the person checks', () => {
  assert.equal(Core.isShowingContent('let me show you my room'), true);
  assert.equal(Core.isShowingContent('this is my kitchen'), true);
  assert.equal(Core.isShowingContent('room tour'), true);
  assert.equal(Core.isShowingContent('take a look at this room'), true);
  assert.equal(Core.isShowingContent('check out my setup'), true);
  assert.equal(Core.isShowingContent('look at the lens'), false);
  assert.equal(Core.isShowingContent('my camera is old'), false);
  assert.equal(Core.isShowingContent('I look tired'), false);
  assert.equal(Core.isTourSession('room tour vlog'), true);
  assert.equal(Core.isTourSession('house tour'), true);
  assert.equal(Core.isTourSession('tour of my kitchen'), true);
  assert.equal(Core.isTourSession('my birthday'), false);
  assert.equal(Core.isTourSession('selfie'), false);
});

test('custom template: own beats become matchable and trackable', () => {
  const items = ['hook', 'demo', 'call to action'];
  const found = Core.findMentions('here is the demo part', 'custom', items);
  assert.ok(found.includes('demo'));
  const c = new Core.ContentChecklist(items);
  c.processText('welcome to the hook', 'custom');
  assert.ok(c.getMissing().includes('demo'));
  assert.equal(c.getCoverage(), 1 / 3);
});

test('occasion matching picks the right template', () => {
  assert.equal(Core.suggestTemplate('making biryani for youtube').templateId, 'recipe');
  assert.equal(Core.suggestTemplate('day vlog in the city').templateId, 'vlog');
  assert.equal(Core.suggestTemplate('reviewing my new headphones').templateId, 'product');
  assert.equal(Core.suggestTemplate('how to fix a puncture').templateId, 'tutorial');
  assert.equal(Core.suggestTemplate('chicken curry night').templateId, 'recipe');
  const unknown = Core.suggestTemplate('my cat does backflips');
  assert.equal(unknown.templateId, 'custom');
  assert.equal(unknown.confidence, 'low');
});

test('setup chat intents: ready/help never become occasions', () => {
  assert.equal(Core.setupIntent("i'm ready", 'done'), 'ready');
  assert.equal(Core.setupIntent("I'm ready!", 'done'), 'ready');
  assert.equal(Core.setupIntent('ready', 'done'), 'ready');
  assert.equal(Core.setupIntent('start recording', 'done'), 'ready');
  assert.equal(Core.setupIntent('where is the checklist here', 'done'), 'help');
  assert.equal(Core.setupIntent('checklist?', 'done'), 'help');
  assert.equal(Core.setupIntent('starting a bakery vlog', 'done'), 'occasion');
  assert.equal(Core.setupIntent('ready meals for the week', 'done'), 'occasion');
  assert.equal(Core.setupIntent('making biryani', 'occasion'), 'occasion');
  assert.equal(Core.setupIntent('Just looking around', 'greet'), 'browse');
  assert.equal(Core.setupIntent('I want to record a video', 'greet'), 'want-record');
});

test('mode detect: photos vs videos vs ambiguous', () => {
  assert.equal(Core.detectMode('take photos'), 'photo');
  assert.equal(Core.detectMode('I want a selfie'), 'photo');
  assert.equal(Core.detectMode('I want to record myself'), 'video');
  assert.equal(Core.detectMode('make a birthday vlog'), 'video');
  assert.equal(Core.detectMode('photos or videos'), null);
  assert.equal(Core.detectMode('hello there'), null);
});

test('photo occasions, shot lists, and tips', () => {
  assert.equal(Core.photoOccasionLabel('random selfie time'), 'selfie');
  assert.equal(Core.photoOccasionLabel('birthday cake cutting'), 'birthday');
  assert.equal(Core.photoOccasionLabel('group photo with friends'), 'group');
  assert.equal(Core.photoOccasionLabel('my new shoes'), 'custom');
  const shots = Core.photoShotList('birthday');
  assert.ok(shots.join(' ').toLowerCase().includes('cake'));
  assert.equal(Core.photoShotList('nope').length, 3);
  const tips = Core.suggestPhotoTips('selfie');
  assert.equal(tips.tips.length, 4);
  assert.match(tips.tips.join(' '), /lens/);
});

test('photo object occasion: subject-aware shot list, not a person checklist', () => {
  assert.equal(Core.photoOccasionLabel('i want to take a picture of a phone'), 'object');
  assert.equal(Core.photoOccasionLabel('take a photo of my new bike'), 'object');
  assert.equal(Core.photoOccasionLabel('a photo with my skincare routine'), 'custom');
  assert.equal(Core.photoOccasionLabel('picture of me and my friends'), 'group');
  assert.equal(Core.photoSubject('i want to take a picture of a phone'), 'the phone');
  assert.equal(Core.photoSubject('take a photo of my new bike'), 'my new bike');
  assert.equal(Core.photoSubject('a photo with my skincare routine'), null);
  const shots = Core.photoShotList('object', 'the phone');
  assert.ok(shots[0].toLowerCase().includes('phone'));
  assert.ok(!shots.join(' ').toLowerCase().includes('get in frame'));
  const tips = Core.suggestPhotoTips('object', 'the phone');
  assert.match(tips.tips.join(' '), /phone/);
});

test('product focus objects: suggested from occasion, everyday words resolve to detector labels', () => {
  assert.deepEqual(Core.suggestFocusObjects('unboxing my new phone'), ['phone']);
  assert.deepEqual(Core.suggestFocusObjects('Reviewing my new headphones'), ['headphones']);
  assert.deepEqual(Core.suggestFocusObjects('handbag review'), ['handbag']);
  assert.deepEqual(Core.suggestFocusObjects('my day at the beach'), []);
  const dets = [{ label: 'cell phone', score: 0.9, bbox: [0, 0, 1, 1] }];
  assert.equal(Core.findDetection(dets, 'phone').label, 'cell phone');
  assert.equal(Core.findDetection(dets, 'charger'), null);
});

test('recording commands: STT-mangled capture still fires in photo mode', () => {
  assert.equal(Core.parseRecordingCommand("it's a photo", 'photo'), 'capture');
  assert.equal(Core.parseRecordingCommand('capital', 'photo'), 'capture');
  assert.equal(Core.parseRecordingCommand('snap a photo', 'photo'), 'capture');
  assert.equal(Core.parseRecordingCommand("it's a photo", 'video'), null);
  assert.equal(Core.parseRecordingCommand('capital', 'video'), null);
});

test('focus words: concrete visible things qualify for SAM prompts', () => {
  assert.equal(Core.isFocusableWord('handbag'), true);
  assert.equal(Core.isFocusableWord('phone'), true);
  assert.equal(Core.isFocusableWord('unboxing'), false);
  assert.equal(Core.isFocusableWord('red bag'), false);
  assert.equal(Core.isFocusableWord(''), false);
});

test('checklist topics: added items are matchable in template sessions', () => {
  assert.ok('handbag' in Core.keywordsForTemplate('product', ['unboxing', 'handbag']));
  assert.ok(Core.findMentions('showing my handbag', 'product', ['unboxing', 'handbag']).includes('handbag'));
  assert.ok(Core.findMentions('hold up the phone', 'vlog', ['Show the phone']).includes('show the phone'));
});

test('alerts: generic demo/subject beats never raise missing-object alerts elsewhere', () => {
  const a = new Core.AlertManager();
  const frame = { issues: [], templateId: 'product' };
  const base = {
    frame, activeTopic: 'demo', topicVisible: false,
    recordingMs: 8000, nowMs: 5000, userName: 'Bhanu', templateId: 'product'
  };
  a.decide(base);
  assert.deepEqual(a.decide({ ...base, nowMs: 5100 }), []);
});

test('alerts: tutorial demo-missing still fires via the primary-subject path', () => {
  const a = new Core.AlertManager();
  const frame = { issues: [{ code: 'DEMO_MISSING' }], templateId: 'tutorial' };
  const base = {
    frame, activeTopic: 'demo', topicVisible: false,
    recordingMs: 8000, nowMs: 5000, userName: 'Bhanu', templateId: 'tutorial'
  };
  a.decide(base);
  const fired = a.decide({ ...base, nowMs: 5000 + 3100 });
  assert.equal(fired.length, 1);
  assert.match(fired[0].text, /demo object is not visible/);
});

test('checklist: alias words cover the item ("the bag" covers handbag)', () => {
  const c = new Core.ContentChecklist(['unboxing', 'handbag']);
  c.processText('this is the bag', 'product');
  assert.ok(c.getMentioned().includes('handbag'));
  assert.ok(!c.getMissing().includes('handbag'));
  const d = new Core.ContentChecklist(['unboxing', 'handbag']);
  d.processText('here is the product', 'product');
  assert.ok(d.getMentioned().includes('handbag'));
});

test('recording commands: capture needs its own word (echo can never retrigger)', () => {
  assert.equal(Core.parseRecordingCommand('Captured photo 2', 'photo'), null);
  assert.equal(Core.parseRecordingCommand('Captured photo 2', 'video'), null);
  assert.equal(Core.parseRecordingCommand('recapture me', 'photo'), null);
  assert.equal(Core.parseRecordingCommand('capture me', 'photo'), 'capture');
  assert.equal(Core.parseRecordingCommand('capture the shot', 'video'), 'capture');
});

test('recording commands: goodbye sign-offs stop the session', () => {
  assert.equal(Core.parseRecordingCommand('bye for this video', 'video'), 'stop');
  assert.equal(Core.parseRecordingCommand('thank you bye bye', 'video'), 'stop');
  assert.equal(Core.parseRecordingCommand("that's it for this video", 'video'), 'stop');
  assert.equal(Core.parseRecordingCommand('goodbye', 'photo'), 'stop');
  assert.equal(Core.parseRecordingCommand('say bye to the camera', 'video'), null);
  assert.equal(Core.parseRecordingCommand('stand by for the video', 'video'), null);
});

test('recording commands: stop is utterance-final, capture contains-matched', () => {
  assert.equal(Core.parseRecordingCommand('stop', 'video'), 'stop');
  assert.equal(Core.parseRecordingCommand('please stop recording', 'photo'), 'stop');
  assert.equal(Core.parseRecordingCommand('okay stop the session', 'video'), 'stop');
  assert.equal(Core.parseRecordingCommand('okay I am done thank you stop the recording', 'video'), 'stop');
  assert.equal(Core.parseRecordingCommand('stop the recording stop the session', 'video'), 'stop');
  assert.equal(Core.parseRecordingCommand("don't stop", 'video'), null);
  assert.equal(Core.parseRecordingCommand('we will stop for lunch', 'video'), null);
  assert.equal(Core.parseRecordingCommand('capture me', 'photo'), 'capture');
  assert.equal(Core.parseRecordingCommand('capture me', 'video'), 'capture'); // video snapshots
  assert.equal(Core.parseRecordingCommand('cheese!', 'photo'), 'capture');
  assert.equal(Core.parseRecordingCommand('to capture me please', 'photo'), 'capture');
  assert.equal(Core.parseRecordingCommand('hey take a session or take a photo', 'video'), 'capture');
  assert.equal(Core.parseRecordingCommand('capture the shot', 'photo'), 'capture');
  assert.equal(Core.parseRecordingCommand('I stopped the bus', 'video'), null);
  assert.equal(Core.parseRecordingCommand('add cheese now', 'video'), null);
  assert.equal(Core.parseRecordingCommand('say cheese', 'video'), 'capture');
  assert.equal(Core.parseRecordingCommand('click the link below', 'video'), null);
  assert.equal(Core.parseRecordingCommand('click it', 'video'), 'capture');
  assert.equal(Core.parseRecordingCommand('I need two eggs', 'video'), null);
  assert.equal(Core.parseRecordingCommand('I need two photos', 'photo'), 'capture');
});

test('look questions detected, normal speech not', () => {
  assert.equal(Core.isLookQuestion('am I looking good'), true);
  assert.equal(Core.isLookQuestion('is my hair on my face'), true);
  assert.equal(Core.isLookQuestion('add the onions now'), false);
});

test('pixel checks: brightness, motion, variance, skin', () => {
  assert.equal(Core.frameBrightness([10, 12, 8]).verdict, 'dark');
  assert.equal(Core.frameBrightness([120, 130, 125]).verdict, 'good');
  assert.equal(Core.frameBrightness([250, 245, 255]).verdict, 'washed');
  assert.equal(Core.frameMotion([100, 100], [100, 100]).moving, false);
  assert.equal(Core.frameMotion([100, 100], [200, 200]).moving, true);
  assert.equal(Core.lumaVariance([120, 120, 120, 120]).busy, false);
  assert.equal(Core.lumaVariance([0, 255, 0, 255]).busy, true);
  assert.ok(Core.skinRatio([200, 150, 120, 210, 160, 130]) > 0.9);
  assert.equal(Core.skinRatio([40, 60, 200, 30, 50, 190]), 0);
});

test('photo scoring rewards good frames, punishes dark/missing', () => {
  const perfect = Core.scorePhoto({ personVisible: true, centerOffset: 0, area: 0.2, brightness: 120, motion: 0 });
  assert.ok(perfect >= 95, 'perfect scored ' + perfect);
  const dark = Core.scorePhoto({ personVisible: true, centerOffset: 0, area: 0.2, brightness: 20, motion: 0 });
  assert.ok(dark < 70, 'dark scored ' + dark);
  const missing = Core.scorePhoto({ personVisible: false, brightness: 120 });
  assert.ok(missing <= 20, 'missing scored ' + missing);
});

test('custom keywords skip stopwords', () => {
  const found = Core.findMentions('the hook is here', 'custom', ['hook', 'call to action']);
  assert.deepEqual(found, ['hook']);
});

test('product review mentions match bag and review talk', () => {
  const found = Core.findMentions('giving a review on a bag', 'product');
  assert.ok(found.includes('product'));
});

test('birthday occasions route to vlog, cake ties go recipe', () => {
  assert.equal(Core.suggestTemplate('birthday party tonight').templateId, 'vlog');
  assert.equal(Core.suggestTemplate('birthday cake cutting').templateId, 'recipe');
});

test('voice start command is anchored', () => {
  assert.equal(Core.parseRecordingCommand('start', 'video'), 'start');
  assert.equal(Core.parseRecordingCommand('start recording', 'photo'), 'start');
  assert.equal(Core.parseRecordingCommand('record', 'video'), 'start');
  assert.equal(Core.parseRecordingCommand('okay start the session', 'video'), 'start');
  assert.equal(Core.parseRecordingCommand('can you start recording now', 'video'), 'start');
  assert.equal(Core.parseRecordingCommand('my day starts early', 'video'), null);
});

test('capture verdict gates unclear shots', () => {
  assert.equal(Core.captureVerdict(85, true).ok, true);
  assert.equal(Core.captureVerdict(30, true).level, 'unclear');
  assert.equal(Core.captureVerdict(70, false).level, 'missing');
});

test('review detailing beats tracked and reminded', () => {
  const c = new Core.ContentChecklist(Core.checklistForTemplate('product'));
  c.processText('unboxing this bag, the price is fair', 'product');
  assert.ok(c.getMissing().includes('design'));
  c.processText('the build quality and material feel premium', 'product');
  assert.ok(c.getMentioned().includes('design'));
});

test('quiet voice speaks issues and answers, not hints or routine', () => {
  assert.equal(Core.voiceAllowed('quiet', 'issue'), true);
  assert.equal(Core.voiceAllowed('quiet', 'answer'), true);
  assert.equal(Core.voiceAllowed('quiet', 'setup'), true);
  assert.equal(Core.voiceAllowed('quiet', 'hint'), false);
  assert.equal(Core.voiceAllowed('quiet', 'routine'), false);
  assert.equal(Core.voiceAllowed('full', 'hint'), true);
  assert.equal(Core.voiceAllowed('full', 'routine'), true);
});

test('echo suppression covers the whole utterance, capped', () => {
  // Long window + shorten-on-end: echo tails can no longer land as user
  // input, and replies are protected by the shorten, not a short window.
  assert.equal(Core.echoSuppressMs('hi'), 2500 + 2 * 90);
  assert.equal(Core.echoSuppressMs('Recording paused — step back into the frame.'), 2500 + 44 * 90);
  assert.equal(Core.echoSuppressMs(new Array(500).join('x')), 20000);
});

test('voice hold: frame alerts stay silent while the pause voice owns them', () => {
  assert.equal(Core.holdAlertVoice('user-missing', true), true);
  assert.equal(Core.holdAlertVoice('framing', true), true);
  assert.equal(Core.holdAlertVoice('checklist', true), false);
  assert.equal(Core.holdAlertVoice('topic:phone', true), false);
  assert.equal(Core.holdAlertVoice('subject-missing', true), false);
  assert.equal(Core.holdAlertVoice('user-missing', false), false);
});

test('mic watchdog: only error-driven churn counts as barren', () => {
  assert.equal(Core.micSessionBarren({ finals: 0, lastError: 'audio-capture', elapsedMs: 900 }), true);
  assert.equal(Core.micSessionBarren({ finals: 0, lastError: 'network', elapsedMs: 2000 }), true);
  assert.equal(Core.micSessionBarren({ finals: 0, lastError: 'no-speech', elapsedMs: 800 }), true);
  assert.equal(Core.micSessionBarren({ finals: 0, lastError: 'no-speech', elapsedMs: 60000 }), false);
  assert.equal(Core.micSessionBarren({ finals: 0, lastError: null, elapsedMs: 900 }), true);
  assert.equal(Core.micSessionBarren({ finals: 2, lastError: null, elapsedMs: 900 }), false);
});

test('photo gate nouns: birthday needs cake, object its subject, selfie you', () => {
  assert.equal(Core.photoRequiredNoun('birthday'), 'cake');
  assert.equal(Core.photoRequiredNoun('selfie'), 'person');
  assert.equal(Core.photoRequiredNoun('object', 'my new handbag'), 'new handbag');
  assert.equal(Core.photoRequiredNoun('object', 'the cake'), 'cake');
  assert.equal(Core.photoRequiredNoun('group'), null);
  assert.equal(Core.photoRequiredNoun('custom'), null);
});

test('alerts: self-referential camera/cam never raise missing-object alerts', () => {
  const a = new Core.AlertManager();
  const frame = { issues: [], templateId: 'vlog' };
  const base = {
    frame, activeTopic: 'camera', topicVisible: false,
    recordingMs: 8000, nowMs: 5000, userName: 'Bhanu', templateId: 'vlog'
  };
  a.decide(base);
  assert.deepEqual(a.decide({ ...base, nowMs: 5100 }), []);
});

test('parrot lines echoing the agent are caught, legit speech is not', () => {
  assert.equal(Core.isAgentParrot('got it sticking with your solo vlog'), true);
  assert.equal(Core.isAgentParrot('describe a new occasion anytime to switch'), true);
  assert.equal(Core.isAgentParrot('say looks good or add x remove why'), true);
  assert.equal(Core.isAgentParrot('birthday vlog'), false);
  assert.equal(Core.isAgentParrot('add candles'), false);
  assert.equal(Core.isAgentParrot('looks good'), false);
  assert.equal(Core.isAgentParrot('add xylophone'), false);
});

test('recorder mime prefers vp9+opus audio, degrades gracefully', () => {
  assert.equal(Core.pickRecorderMime(() => true), 'video/webm;codecs=vp9,opus');
  assert.equal(Core.pickRecorderMime((m) => m !== 'video/webm;codecs=vp9,opus'), 'video/webm;codecs=vp9');
  assert.equal(Core.pickRecorderMime((m) => m === 'video/webm'), 'video/webm');
  assert.equal(Core.pickRecorderMime(() => false), '');
});

test('vision gate waits for simulator or a loaded detector', () => {
  assert.equal(Core.visionReady(true, false, false), true);
  assert.equal(Core.visionReady(false, true, true), true);
  assert.equal(Core.visionReady(false, true, false), false);
  assert.equal(Core.visionReady(false, false, false), false);
});

test('recorder keeps live tracks, drops ended ones', () => {
  const live = { readyState: 'live' }, ended = { readyState: 'ended' };
  assert.deepEqual(Core.liveTracks([live, ended, null]), [live]);
  assert.deepEqual(Core.liveTracks(null), []);
});

test('echo fingerprint ignores the agent\'s own speech, not real commands', () => {
  const spoken = 'Photo session started, Bhanu. All checks passed. Say the word when ready.';
  assert.equal(Core.isLikelyEcho('say the word when ready', spoken), true);
  assert.equal(Core.isLikelyEcho('photo session started bhanu all checks passed say the word when ready', spoken), true);
  assert.equal(Core.isLikelyEcho('capture me', spoken + ' capture me'), false); // short commands pass
  assert.equal(Core.isLikelyEcho('okay sure', 'Okay, I will wait — say I am back when you return.'), false);
  assert.equal(Core.isLikelyEcho('now I add the onions', 'Recording started, Bhanu.'), false);
  assert.equal(Core.isLikelyEcho('', spoken), false);
});

test('checklist edits parse add/remove, reject sentences', () => {
  assert.deepEqual(Core.parseChecklistEdit('add candles'), { action: 'add', item: 'candles' });
  assert.deepEqual(Core.parseChecklistEdit('can you add extra shots'), { action: 'add', item: 'extra shots' });
  assert.deepEqual(Core.parseChecklistEdit('remove onion'), { action: 'remove', item: 'onion' });
  assert.equal(Core.parseChecklistEdit('adding flair today'), null);
  assert.equal(Core.parseChecklistEdit('I want candles'), null);
});

test('extra ingredients heard as topics, never missing-alerts', () => {
  const found = Core.findMentions('eating cucumber with lunch', 'recipe');
  assert.ok(found.includes('cucumber'));
  assert.ok(Core.findMentions('chop potatoes and carrots', 'recipe').includes('potato'));
  const a = new Core.AlertManager();
  const out = a.decide({
    frame: { issues: [] }, activeTopic: 'cucumber', topicVisible: false,
    recordingMs: 8000, nowMs: 5000, userName: 'Bhanu',
    checklistMissing: [], templateId: 'recipe'
  });
  assert.equal(out.length, 0);
});

test('mentionsSelf detects vlog-style self reference', () => {
  assert.equal(Core.mentionsSelf('today I will show you my kitchen'), true);
  assert.equal(Core.mentionsSelf('the rice is ready'), false);
});

test('camera off command stops the camera only', () => {
  assert.equal(Core.parseRecordingCommand('stop camera', 'video'), 'camera-off');
  assert.equal(Core.parseRecordingCommand('camera off', 'photo'), 'camera-off');
  assert.equal(Core.parseRecordingCommand('please turn off the camera', 'video'), 'camera-off');
  assert.equal(Core.parseRecordingCommand('stop the session', 'video'), 'stop');
  assert.equal(Core.parseRecordingCommand('my camera is off', 'video'), null);
});

test('camera voice command starts the camera', () => {
  assert.equal(Core.parseRecordingCommand('start camera', 'video'), 'camera');
  assert.equal(Core.parseRecordingCommand('camera on', 'photo'), 'camera');
  assert.equal(Core.parseRecordingCommand('please turn on the camera', 'video'), 'camera');
  assert.equal(Core.parseRecordingCommand('turn on the camera for me', 'video'), 'camera');
  assert.equal(Core.parseRecordingCommand('can you start the camera', 'video'), 'camera');
  assert.equal(Core.parseRecordingCommand('my camera is old', 'video'), null);
});

test('capture count parses digits and words, clamped 1..10', () => {
  assert.equal(Core.parseCaptureCount('capture 5'), 5);
  assert.equal(Core.parseRecordingCommand('capture 5', 'photo'), 'capture');
  assert.equal(Core.parseCaptureCount('take 3 photos'), 3);
  assert.equal(Core.parseCaptureCount('I want five pictures'), 5);
  assert.equal(Core.parseCaptureCount('take 20 photos'), 10);
  assert.equal(Core.parseCaptureCount('capture me'), null);
  assert.equal(Core.parseCaptureCount('cheese'), null);
  assert.equal(Core.parseRecordingCommand('take 3 photos', 'video'), 'capture');
});

test('away notice pauses missing-you, back notice resumes', () => {
  assert.equal(Core.parseAwayNotice('I am going to get the onions'), 45);
  assert.equal(Core.parseAwayNotice('let me grab the plate'), 45);
  assert.equal(Core.parseAwayNotice('be right back'), 60);
  assert.equal(Core.parseAwayNotice('add the onions now'), null);
  assert.equal(Core.isBackNotice("I'm back"), true);
  assert.equal(Core.isBackNotice('welcome back'), false);
  const a = new Core.AlertManager();
  const frame = { issues: [{ code: 'USER_MISSING' }] };
  const base = { frame, recordingMs: 5000, userName: 'Bhanu', templateId: 'vlog', selfTalking: true };
  a.decide({ ...base, nowMs: 1000 });
  const away = [];
  for (let t = 2000; t <= 20000; t += 1000) {
    a.decide({ ...base, nowMs: t, awayUntilMs: 30000 }).forEach((al) => away.push(al.text));
  }
  assert.equal(away.length, 0);
});

test('missing-you alert needs self-talk context, stays silent otherwise', () => {
  const frame = { issues: [{ code: 'USER_MISSING' }] };
  const base = { frame, recordingMs: 5000, userName: 'Bhanu', templateId: 'vlog' };
  const silent = new Core.AlertManager();
  silent.decide({ ...base, nowMs: 1000 });
  assert.equal(silent.decide({ ...base, nowMs: 60000 }).length, 0); // missing alone never pages
  const gated = new Core.AlertManager();
  gated.decide({ ...base, nowMs: 1000, selfTalking: true });
  assert.equal(gated.decide({ ...base, nowMs: 1000 + 1000, selfTalking: true }).length, 0);
  const fired = gated.decide({ ...base, nowMs: 1000 + 2100, selfTalking: true });
  assert.equal(fired.length, 1);
  assert.match(fired[0].text, /missing from the frame/);
});

test('missing-you alert fires in proactive frame mode without speech', () => {
  const a = new Core.AlertManager();
  const frame = { issues: [{ code: 'USER_MISSING' }] };
  const base = { frame, recordingMs: 5000, nowMs: 1000, userName: 'Bhanu', templateId: 'vlog', proactiveFrame: true };
  assert.equal(a.decide(base).length, 0); // first sighting only arms
  const fired = a.decide({ ...base, nowMs: 6100 });
  assert.equal(fired.length, 1);
  assert.match(fired[0].text, /missing from the frame/);
  const held = new Core.AlertManager();
  held.decide({ ...base, nowMs: 1000, proactiveFrame: true, awayUntilMs: 99999 });
  assert.equal(held.decide({ ...base, nowMs: 9999, proactiveFrame: true, awayUntilMs: 99999 }).length, 0);
});

test('recording pause gate needs persistence both ways', () => {
  const g = new Core.RecordingPause({ pauseAfter: 3, resumeAfter: 2 });
  assert.equal(g.update(true), null);
  assert.equal(g.update(true), null);
  assert.equal(g.update(true), 'pause');
  assert.equal(g.update(true), null); // stays paused, no repeat event
  assert.equal(g.update(false), null); // one good tick: not yet
  assert.equal(g.update(false), 'resume');
  assert.equal(g.update(false), null);
});

test('recording pause gate: reminder latch holds until released', () => {
  const g = new Core.RecordingPause();
  assert.equal(g.forcePause(99999), 'pause');
  assert.equal(g.update(false), null);
  assert.equal(g.update(false), null);
  assert.equal(g.update(false), null);
  g.releaseLatch();
  assert.equal(g.update(false), null);
  assert.equal(g.update(false), 'resume');
});

test('recording pause gate resets clean', () => {
  const g = new Core.RecordingPause({ pauseAfter: 2, resumeAfter: 1 });
  g.update(true);
  g.reset();
  assert.equal(g.update(true), null); // count restarted
  assert.equal(g.update(true), 'pause');
});

test('recording pause gate defaults: two bad ticks pause, two good resume', () => {
  const g = new Core.RecordingPause();
  assert.equal(g.update(true), null); // first bad tick arms
  assert.equal(g.update(true), 'pause');
  assert.equal(g.update(false), null); // one good tick: not yet
  assert.equal(g.update(false), 'resume');
});

test('poll schedule: launched polls wait the full interval, skipped polls retry fast', () => {
  assert.equal(Core.nextPollDelay(true), 4000); // on cadence, no spam
  assert.equal(Core.nextPollDelay(false), 1000); // a skip must not cost a full interval
});

test('checklist tracks coverage order and skipped beats', () => {
  const c = new Core.ContentChecklist(['rice', 'chicken', 'salt']);
  c.processText('the chicken is ready', 'recipe');
  assert.deepEqual(c.getSkipped(), ['rice']);
  assert.match(c.getOrderNote(), /chicken was covered before rice/);
  c.processText('rice is done', 'recipe');
  assert.deepEqual(c.getSkipped(), []);
  assert.equal(c.getOrderNote(), null);
});

test('vlog beats match their own bare words', () => {
  const c = new Core.ContentChecklist(['intro', 'location', 'story', 'highlight', 'outro']);
  c.processText('my intro', 'vlog');
  c.processText('the location', 'vlog');
  c.processText('story time', 'vlog');
  c.processText('a highlight', 'vlog');
  c.processText('the outro', 'vlog');
  assert.deepEqual(c.getMissing(), []);
});

test('checklist: trailing beats are unreached, jumped-over beats are skipped', () => {
  const c = new Core.ContentChecklist(['intro', 'story', 'outro']);
  c.processText('hey this is my intro', 'vlog');
  assert.deepEqual(c.getSkipped(), []); // story + outro simply not yet said
  c.processText('thanks for watching, that is the outro', 'vlog');
  assert.deepEqual(c.getSkipped(), ['story']); // jumped over it
});

test('angle questions count as look questions', () => {
  assert.equal(Core.isLookQuestion('is this angle ok'), true);
  assert.equal(Core.isLookQuestion('how is my angle'), true);
  assert.equal(Core.isLookQuestion('is this shot ok'), true);
  assert.equal(Core.isLookQuestion('add the onions now'), false);
});

test('checklist approval locks the list, sentences do not', () => {
  assert.equal(Core.isApproval('yes'), true);
  assert.equal(Core.isApproval('looks good'), true);
  assert.equal(Core.isApproval('approve'), true);
  assert.equal(Core.isApproval('lock it'), true);
  assert.equal(Core.isApproval('lock'), true);
  assert.equal(Core.isApproval('lock it in'), true);
  assert.equal(Core.isApproval('add candles'), false);
  assert.equal(Core.isApproval('birthday vlog'), false);
  assert.equal(Core.isApproval('clock'), false);
});

test('occasion hints catch real vlog phrasings', () => {
  assert.equal(Core.suggestTemplate('i want to make a room tour').templateId, 'vlog');
  assert.equal(Core.suggestTemplate('my daily log').templateId, 'vlog');
  assert.equal(Core.suggestTemplate('hey I wanted to record myself').templateId, 'vlog');
  assert.equal(Core.suggestTemplate('i want my face in this video').templateId, 'vlog');
  assert.equal(Core.suggestTemplate('i want to make a room tour').confidence, 'high');
});

test('lock+ready combos lock and roll in one breath, wishes do not', () => {
  assert.equal(Core.parseLockReady("looks good, I'm ready"), true);
  assert.equal(Core.parseLockReady("I'm ready, looks good"), true);
  assert.equal(Core.parseLockReady('looks good and I am ready'), true);
  assert.equal(Core.parseLockReady('looks good'), false);
  assert.equal(Core.parseLockReady("I hope I look good when I'm ready"), false);
  assert.equal(Core.parseLockReady("tell me when I'm ready"), false);
});

test('setup ready accepts trailing starts too', () => {
  assert.equal(Core.setupIntent("I'm ready start recording", 'done'), 'ready');
  assert.equal(Core.setupIntent("I'm ready, let's go", 'done'), 'ready');
  assert.equal(Core.setupIntent('ready meals for the week', 'done'), 'occasion');
});

test('setup ready accepts conversational leads, not questions about readiness', () => {
  assert.equal(Core.setupIntent("when you are ready I'm ready", 'done'), 'ready');
  assert.equal(Core.setupIntent("so I'm ready", 'done'), 'ready');
  assert.equal(Core.setupIntent('well, ready', 'done'), 'ready');
  assert.equal(Core.setupIntent("tell me when I'm ready", 'done'), 'occasion');
  assert.equal(Core.setupIntent('ready meals for the week', 'done'), 'occasion');
});

test('gesture shutter: raised hand starts a countdown, capture fires after the delay', () => {
  const g = new Core.GestureShutter({ delayMs: 5000, cooldownMs: 10000 });
  assert.equal(g.update(false, 0), null);
  assert.equal(g.update(true, 1000), 'countdown');
  assert.equal(g.update(true, 2000), null); // hand still up: no retrigger
  assert.equal(g.update(false, 3000), null); // hand may drop, countdown keeps running
  assert.equal(g.update(false, 5999), null);
  assert.equal(g.update(false, 6000), 'capture');
  assert.equal(g.remainingSec(6000), 0);
});

test('gesture shutter: cooldown blocks retrigger until the hand drops and time passes', () => {
  const g = new Core.GestureShutter({ delayMs: 5000, cooldownMs: 10000 });
  g.update(false, 0);
  assert.equal(g.update(true, 1000), 'countdown');
  assert.equal(g.update(false, 6000), 'capture'); // cooldown until 16000
  assert.equal(g.update(true, 7000), null); // too soon
  g.update(false, 8000); // re-arm with a falling edge
  assert.equal(g.update(true, 9000), null); // still cooling down
  assert.equal(g.update(false, 17000), null);
  assert.equal(g.update(true, 17001), 'countdown');
});

test('gesture shutter: reset cancels a running countdown', () => {
  const g = new Core.GestureShutter({ delayMs: 5000, cooldownMs: 10000 });
  g.update(false, 0);
  assert.equal(g.update(true, 1000), 'countdown');
  assert.ok(g.remainingSec(2000) > 0);
  g.reset();
  assert.equal(g.remainingSec(2000), 0);
  assert.equal(g.update(false, 6000), null); // nothing fires
});

test('handbag video: occasion maps to product, mention tracked without checklist', () => {
  assert.equal(Core.suggestTemplate('video with my new handbag').templateId, 'product');
  assert.equal(Core.suggestTemplate('handbag review').templateId, 'product');
  assert.equal(Core.suggestTemplate('video with my new handbag').confidence, 'high');
  assert.ok(Core.findMentions('showing my handbag', 'product').includes('handbag'));
  assert.ok(Core.findMentions('this is my new handbag', 'custom').includes('handbag'));
});

test('handbag video: focusable mention alerts when not visible', () => {
  assert.equal(Core.isVisualTopic('handbag'), true);
  const a = new Core.AlertManager();
  const frame = { issues: [], templateId: 'product' };
  const base = {
    frame, activeTopic: 'handbag', topicVisible: false,
    recordingMs: 8000, nowMs: 5000, userName: 'Bhanu', templateId: 'product'
  };
  a.decide(base); // first sighting arms the episode
  const fired = a.decide({ ...base, nowMs: 5000 + 100 });
  assert.equal(fired.length, 1);
  assert.match(fired[0].text, /handbag.*not visible/);
});

test('new session request resets occasion instead of sticking', () => {
  assert.equal(Core.isNewSessionRequest('I want a new session'), true);
  assert.equal(Core.isNewSessionRequest('start a new session of photos'), true);
  assert.equal(Core.isNewSessionRequest('start over'), true);
  assert.equal(Core.isNewSessionRequest("I'm ready"), false);
  assert.equal(Core.isNewSessionRequest('birthday vlog'), false);
});

test('zoom: product-only fill frames the box, capped at max', () => {
  const z = new Core.ZoomController();
  const small = { label: 'handbag', score: 0.9, bbox: [0.4, 0.3, 0.2, 0.2] };
  for (let i = 0; i < 80; i++) z.update({ detection: small, fill: true });
  assert.ok(z.zoom > 2.5 && z.zoom <= 3.0, 'expected tight fill, got ' + z.zoom);
  const crop = z.getCrop(640, 360);
  assert.ok(crop.w <= 220, 'expected narrow crop, got ' + crop.w);
});

test('zoom: fill stays wide when the product already fills the frame', () => {
  const z = new Core.ZoomController();
  const big = { label: 'handbag', score: 0.9, bbox: [0.1, 0.1, 0.8, 0.7] };
  for (let i = 0; i < 80; i++) z.update({ detection: big, fill: true });
  assert.ok(z.zoom < 1.3, 'expected near-wide, got ' + z.zoom);
});

test('zoom: person keeps the fixed gentle push-in', () => {
  const z = new Core.ZoomController();
  for (let i = 0; i < 80; i++) z.update({ detection: person(), fill: false });
  assert.ok(Math.abs(z.zoom - Core.ZOOM_IN_LEVEL) < 0.05, 'got ' + z.zoom);
});

test('presence: vlog needs you always, product needs the product, showing needs neither', () => {
  assert.deepEqual(Core.presenceNeeded('vlog', {}), { needUser: true, needSubject: false });
  assert.deepEqual(Core.presenceNeeded('vlog', { showing: true }), { needUser: false, needSubject: false });
  assert.deepEqual(Core.presenceNeeded('product', {}), { needUser: false, needSubject: true });
  assert.deepEqual(Core.presenceNeeded('recipe', { selfTalking: true, subjectTalked: true }), { needUser: true, needSubject: true });
  assert.deepEqual(Core.presenceNeeded('recipe', {}), { needUser: false, needSubject: false });
});

test('recording gate: pauses on needed-missing, cropped, or bad light only', () => {
  assert.equal(Core.recordingBlocked({ needUser: true, userMissing: true }).blocked, true);
  assert.equal(Core.recordingBlocked({ needUser: false, userMissing: true }).blocked, false);
  assert.equal(Core.recordingBlocked({ needSubject: true, subjectMissing: true }).blocked, true);
  assert.equal(Core.recordingBlocked({ needSubject: false, subjectMissing: true }).blocked, false);
  assert.equal(Core.recordingBlocked({ tooClose: true }).blocked, true);
  assert.equal(Core.recordingBlocked({ light: 'dark' }).blocked, true);
  assert.equal(Core.recordingBlocked({ light: 'washed' }).blocked, true);
  assert.equal(Core.recordingBlocked({ light: 'good' }).blocked, false);
  assert.deepEqual(Core.recordingBlocked({ needUser: true, userMissing: true }).reasons, ['user']);
});

test('held-near-face: product up at the face counts as showing', () => {
  const face = [0.37, 0.2, 0.26, 0.55]; // person box
  assert.equal(Core.isHeldNearFace(face, [0.45, 0.25, 0.15, 0.15]), true); // overlapping the face
  assert.equal(Core.isHeldNearFace(face, [0.62, 0.55, 0.22, 0.3]), false); // down at the table
  assert.equal(Core.isHeldNearFace(face, [0.0, 0.25, 0.1, 0.1]), false); // far left edge
  assert.equal(Core.isHeldNearFace(null, [0.45, 0.25, 0.15, 0.15]), false);
});

test('forgot query lists only uncovered beats', () => {
  assert.equal(Core.isForgotQuery('what did I forget to say'), true);
  assert.equal(Core.isForgotQuery('what did I miss'), true);
  assert.equal(Core.isForgotQuery('what is remaining'), true);
  assert.equal(Core.isForgotQuery('I forgot my keys'), false);
  assert.equal(Core.isForgotQuery('capture me'), false);
});

test('half-out: side walk-outs and top cuts flag, normal close-ups do not', () => {
  assert.equal(Core.personHalfOut([0.55, 0.2, 0.45, 0.7]), true); // half out right
  assert.equal(Core.personHalfOut([0.0, 0.2, 0.45, 0.7]), true); // half out left
  assert.equal(Core.personHalfOut([0.0, 0.15, 1.0, 0.85]), false); // centered close-up, both sides
  assert.equal(Core.personHalfOut([0.2, 0.3, 0.6, 0.7]), false); // talking head, bottom touch only
  assert.equal(Core.personHalfOut([0.3, 0.0, 0.4, 0.6]), true); // head cut at the top
  assert.equal(Core.personHalfOut([0.3, 0.0, 0.4, 1.0]), false); // raised arm over a full body
  assert.equal(Core.personHalfOut(null), false);
});

test('frame judge: half-out person issues PERSON_HALF_OUT and fails good', () => {
  const f = Core.analyzeFrame({
    detections: [{ label: 'person', score: 0.9, bbox: [0.55, 0.2, 0.45, 0.7] }],
    templateId: 'vlog'
  });
  assert.ok(f.issues.some((it) => it.code === 'PERSON_HALF_OUT'), JSON.stringify(f.issues));
  assert.equal(f.good, false);
});

test('recording gate: half-out blocks on its own', () => {
  assert.equal(Core.recordingBlocked({ halfOut: true }).blocked, true);
  assert.deepEqual(Core.recordingBlocked({ halfOut: true }).reasons, ['half']);
  assert.equal(Core.recordingBlocked({}).blocked, false);
});

test('sticky subject: a recently held object stays the SAM query', () => {
  assert.equal(Core.stickySubject('phone', 10000, 25000), 'phone'); // 15s old: fresh
  assert.equal(Core.stickySubject('phone', 10000, 45000), null); // 35s old: stale
  assert.equal(Core.stickySubject('camcorder', 10000, 15000), null); // not a SAM-able word
  assert.equal(Core.stickySubject(null, 10000, 15000), null);
});

test('answer lift: user speech lifts reminder pauses only', () => {
  const base = { latched: true, recordPaused: true, speaking: false, echoQuiet: true, lastSpeechMs: 9000, nowMs: 9500 };
  assert.equal(Core.answerLift(base), true);
  assert.equal(Core.answerLift(Object.assign({}, base, { speaking: true })), false); // agent owns the mic
  assert.equal(Core.answerLift(Object.assign({}, base, { echoQuiet: false })), false); // echo tail window
  assert.equal(Core.answerLift(Object.assign({}, base, { lastSpeechMs: 1000 })), false); // stale speech
  assert.equal(Core.answerLift(Object.assign({}, base, { latched: false })), false); // rule pause stays strict
  assert.equal(Core.answerLift(Object.assign({}, base, { recordPaused: false })), false); // already rolling
});
