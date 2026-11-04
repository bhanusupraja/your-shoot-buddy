/* Wiring tests: index.html <-> app.js <-> agent-core.js stay in sync.
   Run: npm test   (from the solo-cameraman folder) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const Core = require('../agent-core.js');

test('wiring: every local page asset exists', () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)].map((m) => m[1])
    .filter((u) => !/^https?:|data:/.test(u));
  assert.ok(refs.length >= 3, 'expected local refs, got ' + refs.join(','));
  refs.forEach((r) => {
    assert.ok(fs.existsSync(path.join(ROOT, r)), 'missing asset: ' + r);
  });
});

test('wiring: every element id used by app.js exists in index.html', () => {
  const defined = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const used = new Set([
    ...[...appJs.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]),
    ...[...appJs.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1])
  ]);
  assert.ok(used.size > 10, 'expected many element refs');
  [...used].forEach((id) => assert.ok(defined.has(id), 'missing element id: ' + id));
});

test('wiring: installable-web-app manifest + iOS icon are declared and exist', () => {
  assert.ok(html.includes('rel="manifest"'), 'missing manifest link');
  assert.ok(html.includes('rel="apple-touch-icon"'), 'missing apple touch icon');
  assert.ok(html.includes('apple-mobile-web-app-capable'), 'missing iOS capable meta');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.ok(manifest.icons.length >= 2, 'expected manifest icons');
  manifest.icons.forEach((icon) => {
    assert.ok(fs.existsSync(path.join(ROOT, icon.src)), 'missing icon: ' + icon.src);
  });
});

test('wiring: every Core API used by app.js is exported', () => {
  const used = new Set([...appJs.matchAll(/Core\.(\w+)/g)].map((m) => m[1]));
  assert.ok(used.size > 5, 'expected several Core uses');
  [...used].forEach((name) => assert.ok(Core[name], 'agent-core missing export: ' + name));
});

test('wiring: simple demo view hooks exist', () => {
  assert.ok(html.includes('id="btnView"'), 'missing view toggle button');
  ['setupPanel', 'simPanel', 'transcriptPanel', 'logPanel'].forEach((id) => {
    assert.ok(html.includes('id="' + id + '"'), 'missing panel id: ' + id);
  });
  assert.ok(appJs.includes("classList.toggle('simple'"), 'app never toggles simple view');
  assert.ok(appJs.includes("get('view')"), 'app never reads ?view=');
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  assert.ok(css.includes('body.simple'), 'missing simple-view styles');
});

test('wiring: welcome first screen hooks exist', () => {
  assert.ok(html.includes('id="welcome"'), 'missing welcome overlay');
  assert.ok(html.includes('id="btnWelcomeStart"'), 'missing welcome start button');
  assert.ok(appJs.includes("classList.add('welcomed')"), 'app never dismisses welcome');
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  assert.ok(css.includes('.welcome-overlay'), 'missing welcome styles');
  assert.ok(css.includes('body.welcomed'), 'missing welcome dismiss rule');
});
