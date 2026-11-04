const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8081;
const HOST = process.env.HOST || '127.0.0.1'; // phone on same Wi-Fi: HOST=0.0.0.0 npm start
const DEFAULT_API_BASE = process.env.META_API_BASE || 'https://api.meta.ai/v1';
const SAM_MODEL = 'sam-3.1';
const SPARK_MODEL = 'muse-spark-1.3';
const MAX_IMAGE_BODY = 15 * 1024 * 1024;

// ---- Demo guard (per Yash/Meta office hours) ----
// Key stays server-side AND the proxy itself is guarded: optional demo
// token, per-IP rate limit, server-enforced SAM cadence, daily upstream
// call cap. CORS is deliberately not relied on (it stops browsers, not
// scripts) — and this server sends no CORS headers at all.
const DEMO_TOKEN = process.env.DEMO_TOKEN || '';
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_PER_MIN = 120;
const SAM_MIN_INTERVAL_MS = 4000;
const DAILY_CALL_CAP = Number(process.env.DAILY_CALL_CAP) || 2000;

function tokenAccepted(provided, expected) {
  if (!expected) return true; // no token configured: open local dev
  return String(provided || '') === String(expected);
}

function rateAllowed(store, ip, nowMs, windowMs, max) {
  var st = store[ip];
  if (!st || nowMs - st.start >= windowMs) {
    store[ip] = { start: nowMs, count: 1 };
    return true;
  }
  st.count++;
  return st.count <= max;
}

// One SAM call per prompt per interval: the legit client fires person +
// subject together each poll, so keying by prompt keeps that working while
// a spam loop on one prompt gets throttled.
function samCadenceAllowed(store, ip, prompt, nowMs, minMs) {
  var key = ip + ':' + String(prompt || '').toLowerCase();
  if (key in store && nowMs - store[key] < minMs) return false;
  store[key] = nowMs;
  return true;
}

function dailyCapCheck(store, nowMs, cap) {
  var day = new Date(nowMs).toISOString().slice(0, 10);
  if (store.day !== day) { store.day = day; store.count = 0; }
  if (store.count >= cap) return { allowed: false, remaining: 0 };
  store.count++;
  return { allowed: true, remaining: cap - store.count };
}

// ---- Meta Model API response parsing (pure, unit-tested) ----

// Responses API puts model text in output[].content[] as output_text parts;
// accept a top-level output_text string too.
function extractOutputText(body) {
  if (!body || typeof body !== 'object') return '';
  if (typeof body.output_text === 'string') return body.output_text;
  const texts = [];
  (body.output || []).forEach((item) => {
    (item.content || []).forEach((part) => {
      if (part && (part.type === 'output_text' || part.type === 'text') && typeof part.text === 'string') {
        texts.push(part.text);
      }
    });
  });
  return texts.join('\n');
}

// SAM box grammar: <|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..[;c=..]|>
// Coordinates are media pixels; w/h are the source dims, so normalize by
// them into the app's 0..1 bboxes. Masks are ignored (boxes drive the app).
const SAM_BOX_RE = /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>/g;

function parseSamBoxes(outputText, label) {
  const text = String(outputText || '').trim();
  if (!text) return []; // zero matches is a normal result, not an error
  const out = [];
  SAM_BOX_RE.lastIndex = 0;
  let m;
  while ((m = SAM_BOX_RE.exec(text)) !== null) {
    const w = Number(m[5]);
    const h = Number(m[6]);
    if (!w || !h) continue;
    out.push({
      label: String(label || 'object').toLowerCase(),
      score: m[7] !== undefined ? Number(m[7]) : 0.85,
      bbox: [
        Math.max(0, Number(m[1]) / w),
        Math.max(0, Number(m[2]) / h),
        Math.min(1, (Number(m[3]) - Number(m[1])) / w),
        Math.min(1, (Number(m[4]) - Number(m[2])) / h)
      ]
    });
  }
  return out;
}

// Spark returns strict JSON; anything else degrades to "nothing heard".
function parseReasonJson(outputText) {
  const empty = { mentioned: [], focus: null };
  const m = String(outputText || '').match(/\{[\s\S]*\}/);
  if (!m) return empty;
  try {
    const obj = JSON.parse(m[0]);
    if (!obj || !Array.isArray(obj.mentioned)) return empty;
    return {
      mentioned: obj.mentioned.filter((x) => typeof x === 'string').slice(0, 8),
      focus: typeof obj.focus === 'string' ? obj.focus : null
    };
  } catch (e) {
    return empty;
  }
}

function callResponses(apiBase, apiKey, payload) {
  return fetch(apiBase + '/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify(payload)
  }).then((res) => {
    if (!res.ok) throw new Error('upstream ' + res.status);
    return res.json();
  });
}

function readJsonBody(req, limit) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > limit) {
        reject(new Error('too-large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webm': 'video/webm'
};

function lanIPs() {
  const out = [];
  try {
    const os = require('os');
    for (const nets of Object.values(os.networkInterfaces())) {
      for (const n of nets || []) {
        if (n.family === 'IPv4' && !n.internal) out.push(n.address);
      }
    }
  } catch (e) { /* ignore */ }
  return out;
}

function serveStatic(req, res) {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403); res.end('forbidden');
      return;
    }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
  } catch (e) {
    res.writeHead(500); res.end('error');
  }
}

function start(options) {
  options = options || {};
  const apiBase = options.apiBase || DEFAULT_API_BASE;
  const apiKey = options.apiKey !== undefined ? options.apiKey : (process.env.MODEL_API_KEY || '');
  const port = options.port !== undefined ? options.port : PORT;
  const host = options.host || HOST;
  const quiet = !!options.quiet;
  const demoToken = options.demoToken !== undefined ? options.demoToken : DEMO_TOKEN;
  const dailyCap = options.dailyCap !== undefined ? options.dailyCap : DAILY_CALL_CAP;
  const guard = { rate: {}, sam: {}, day: { day: '', count: 0 } };

  function clientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
    return (req.socket && req.socket.remoteAddress) || 'unknown';
  }

  function providedToken(req) {
    if (req.headers['x-demo-token']) return req.headers['x-demo-token'];
    const qi = req.url.indexOf('?');
    if (qi !== -1) {
      try {
        return new URLSearchParams(req.url.slice(qi)).get('token');
      } catch (e) { /* fall through */ }
    }
    return null;
  }

  // Shared pre-checks for every /api/* route except /api/health (which only
  // reports whether a key is set). Returns true when the request may proceed.
  function guardApi(req, res) {
    if (!tokenAccepted(providedToken(req), demoToken)) {
      sendJson(res, 401, { error: 'bad-token' });
      return false;
    }
    if (!rateAllowed(guard.rate, clientIp(req), Date.now(), RATE_WINDOW_MS, RATE_MAX_PER_MIN)) {
      sendJson(res, 429, { error: 'rate-limited' });
      return false;
    }
    return true;
  }

  function guardUpstream(res) {
    const cap = dailyCapCheck(guard.day, Date.now(), dailyCap);
    if (!cap.allowed) {
      sendJson(res, 429, { error: 'demo-paused' });
      return false;
    }
    return true;
  }

  const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    if (req.method === 'GET' && urlPath === '/api/health') {
      sendJson(res, 200, { sam: !!apiKey, spark: !!apiKey });
      return;
    }
    if (req.method === 'POST' && urlPath === '/api/sam') {
      if (!apiKey) {
        sendJson(res, 503, { error: 'no-key' });
        return;
      }
      if (!guardApi(req, res)) return;
      readJsonBody(req, MAX_IMAGE_BODY).then((body) => {
        const image = String(body.image || '');
        const prompt = String(body.prompt || '').trim();
        if (!image || !prompt) {
          sendJson(res, 400, { error: 'need-image-and-prompt' });
          return;
        }
        if (!samCadenceAllowed(guard.sam, clientIp(req), prompt, Date.now(), SAM_MIN_INTERVAL_MS)) {
          sendJson(res, 429, { error: 'too-fast' });
          return;
        }
        if (!guardUpstream(res)) return;
        return callResponses(apiBase, apiKey, {
          model: SAM_MODEL,
          input: [{ role: 'user', content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: image }
          ] }],
          stream: false
        }).then((up) => {
          sendJson(res, 200, { detections: parseSamBoxes(extractOutputText(up), prompt) });
        });
      }).catch((err) => {
        sendJson(res, err && err.message === 'too-large' ? 413 : 502, { error: 'sam-failed' });
      });
      return;
    }
    if (req.method === 'POST' && urlPath === '/api/reason') {
      if (!apiKey) {
        sendJson(res, 503, { error: 'no-key' });
        return;
      }
      if (!guardApi(req, res)) return;
      readJsonBody(req, 64 * 1024).then((body) => {
        if (!guardUpstream(res)) return;
        const beats = (body.checklist || []).join(', ');
        const input = 'You are the topic spotter for a ' + String(body.templateId || 'custom') + ' video session.\n' +
          'Checklist beats: ' + beats + '\n' +
          'Transcript line: "' + String(body.text || '') + '"\n' +
          'Return ONLY JSON: {"mentioned": [checklist beats or visible objects named in the line], "focus": "one visible object to zoom to, or null"}.';
        return callResponses(apiBase, apiKey, {
          model: SPARK_MODEL,
          input: [{ role: 'user', content: [{ type: 'input_text', text: input }] }],
          stream: false
        }).then((up) => {
          sendJson(res, 200, parseReasonJson(extractOutputText(up)));
        });
      }).catch(() => {
        sendJson(res, 502, { error: 'reason-failed' });
      });
      return;
    }
    serveStatic(req, res);
  });

  server.listen(port, host, () => {
    if (quiet) return;
    console.log(`Solo Cameraman running at http://${host}:${port}`);
    console.log('  Meta API key: ' + (apiKey ? 'set — SAM + Spark live.' : 'missing — set MODEL_API_KEY for vision/reasoning; simulator still works.'));
    console.log('  Demo guard: ' + (demoToken ? 'token required' : 'open (set DEMO_TOKEN to lock)') +
      ', ' + RATE_MAX_PER_MIN + '/min per IP, SAM 1/' + (SAM_MIN_INTERVAL_MS / 1000) + 's per prompt, ' +
      dailyCap + ' upstream calls/day.');
    if (host === '0.0.0.0') {
      lanIPs().forEach((ip) => console.log(`  on your phone (same Wi-Fi): http://${ip}:${port}`));
    } else {
      console.log('  for phone access, restart with: HOST=0.0.0.0 npm start');
    }
    console.log('Press Ctrl+C to stop.');
  });
  return server;
}

if (require.main === module) start();

module.exports = { start, extractOutputText, parseSamBoxes, parseReasonJson, tokenAccepted, rateAllowed, samCadenceAllowed, dailyCapCheck };
