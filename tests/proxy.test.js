'use strict';
// Proxy tests: SAM box parsing, Spark JSON parsing, and the /api/* routes
// against a stub upstream — no network, no real key needed.
const assert = require('node:assert');
const test = require('node:test');
const http = require('node:http');
const proxy = require('../server.js');

const SAM_LINE = '<0f>0,<|box;x1=64;y1=36;x2=320;y2=324;w=640;h=360;c=0.92|>,<|mask;x=0;y=0;data=37,51,!abc|>,' +
  '1,<|box;x1=400;y1=100;x2=600;y2=300;w=640;h=360|>,<|mask;x=0;y=0;data=37,51,!def|>';

test('proxy: SAM output text parses to normalized detections', () => {
  const dets = proxy.parseSamBoxes(SAM_LINE, 'person');
  assert.equal(dets.length, 2);
  assert.equal(dets[0].label, 'person');
  assert.equal(dets[0].score, 0.92);
  assert.deepEqual(dets[0].bbox, [64 / 640, 36 / 360, (320 - 64) / 640, (324 - 36) / 360]);
  assert.equal(dets[1].score, 0.85); // default when the model sends no confidence
});

test('proxy: empty SAM output is zero matches, not an error', () => {
  assert.deepEqual(proxy.parseSamBoxes('', 'cake'), []);
  assert.deepEqual(proxy.parseSamBoxes('   ', 'cake'), []);
});

test('proxy: output text extraction walks the Responses shape', () => {
  const body = { output: [{ type: 'message', content: [{ type: 'output_text', text: 'hello' }] }] };
  assert.equal(proxy.extractOutputText(body), 'hello');
  assert.equal(proxy.extractOutputText({ output_text: 'direct' }), 'direct');
  assert.equal(proxy.extractOutputText({}), '');
});

test('proxy: Spark JSON parsing validates shape, garbage yields empty', () => {
  const good = proxy.parseReasonJson('{"mentioned": ["unboxing", "phone"], "focus": "phone"}');
  assert.deepEqual(good, { mentioned: ['unboxing', 'phone'], focus: 'phone' });
  assert.deepEqual(proxy.parseReasonJson('not json at all'), { mentioned: [], focus: null });
  assert.deepEqual(proxy.parseReasonJson('{"mentioned": "oops"}'), { mentioned: [], focus: null });
});

function startStub(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

test('proxy: /api/sam and /api/reason forward to upstream and shape the reply', async () => {
  const seen = {};
  const stub = await startStub((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      seen.auth = req.headers.authorization;
      const body = JSON.parse(raw);
      seen.model = body.model;
      const text = body.model === 'sam-3.1' ? SAM_LINE : '{"mentioned": ["design"], "focus": null}';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }));
    });
  });
  const app = proxy.start({ port: 0, host: '127.0.0.1', apiBase: stub.base, apiKey: 'LLM_test_key', quiet: true });
  await new Promise((r) => app.on('listening', r));
  const base = 'http://127.0.0.1:' + app.address().port;
  try {
    const post = async (path, obj) => (await fetch(base + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj)
    })).json();
    const sam = await post('/api/sam', { image: 'data:image/jpeg;base64,xx', prompt: 'person' });
    assert.equal(sam.detections.length, 2);
    assert.equal(sam.detections[0].label, 'person');
    assert.equal(seen.auth, 'Bearer LLM_test_key');
    assert.equal(seen.model, 'sam-3.1');
    const reason = await post('/api/reason', { text: 'look at the design', templateId: 'product', checklist: [] });
    assert.deepEqual(reason.mentioned, ['design']);
    assert.equal(seen.model, 'muse-spark-1.3');
    const health = await (await fetch(base + '/api/health')).json();
    assert.deepEqual(health, { sam: true, spark: true });
  } finally {
    app.close();
    stub.srv.close();
  }
});

test('proxy: demo token gate is open without a token, strict with one', () => {
  assert.equal(proxy.tokenAccepted(null, ''), true);
  assert.equal(proxy.tokenAccepted('anything', ''), true);
  assert.equal(proxy.tokenAccepted('judges-123', 'judges-123'), true);
  assert.equal(proxy.tokenAccepted(null, 'judges-123'), false);
  assert.equal(proxy.tokenAccepted('wrong', 'judges-123'), false);
});

test('proxy: per-IP rate limit refills each window', () => {
  const store = {};
  for (let i = 0; i < 120; i++) assert.equal(proxy.rateAllowed(store, '1.2.3.4', 1000, 60000, 120), true);
  assert.equal(proxy.rateAllowed(store, '1.2.3.4', 2000, 60000, 120), false);
  assert.equal(proxy.rateAllowed(store, '5.6.7.8', 2000, 60000, 120), true); // other IP unaffected
  assert.equal(proxy.rateAllowed(store, '1.2.3.4', 1000 + 60000, 60000, 120), true); // new window
});

test('proxy: SAM cadence is one call per prompt per interval', () => {
  const store = {};
  assert.equal(proxy.samCadenceAllowed(store, 'ip', 'person', 0, 4000), true);
  assert.equal(proxy.samCadenceAllowed(store, 'ip', 'handbag', 0, 4000), true); // legit pair poll
  assert.equal(proxy.samCadenceAllowed(store, 'ip', 'person', 1000, 4000), false); // spam loop
  assert.equal(proxy.samCadenceAllowed(store, 'ip', 'person', 4000, 4000), true);
});

test('proxy: daily cap blocks at the limit, resets next day', () => {
  const store = { day: '', count: 0 };
  const t0 = Date.UTC(2026, 10, 4, 12, 0, 0);
  assert.equal(proxy.dailyCapCheck(store, t0, 2).allowed, true);
  assert.equal(proxy.dailyCapCheck(store, t0 + 1000, 2).allowed, true);
  assert.deepEqual(proxy.dailyCapCheck(store, t0 + 2000, 2), { allowed: false, remaining: 0 });
  assert.equal(proxy.dailyCapCheck(store, t0 + 86400000, 2).allowed, true); // next day
});

test('proxy: routes refuse without a key, health reports it', async () => {
  const app = proxy.start({ port: 0, host: '127.0.0.1', apiKey: '', quiet: true });
  await new Promise((r) => app.on('listening', r));
  const base = 'http://127.0.0.1:' + app.address().port;
  try {
    const res = await fetch(base + '/api/sam', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.equal(res.status, 503);
    const health = await (await fetch(base + '/api/health')).json();
    assert.deepEqual(health, { sam: false, spark: false });
  } finally {
    app.close();
  }
});
