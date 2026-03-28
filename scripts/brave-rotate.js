#!/usr/bin/env node
/**
 * Brave Search API Key Rotator
 * Usage:
 *   node brave-rotate.js status   — show which key is active
 *   node brave-rotate.js rotate   — swap to other key
 *   node brave-rotate.js reset    — reset to KEY_1 (use on month reset)
 *   node brave-rotate.js check    — test active key, rotate if 402
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const OPENCLAW_CONFIG = path.join(process.env.HOME, '.openclaw', 'openclaw.json');
const SECRETS_FILE = 'YOUR_WORKSPACE_PATH/.secrets.md';
const FAILURE_LOG = 'YOUR_WORKSPACE_PATH/memory/failure-log.jsonl';

function readSecrets() {
  const content = fs.readFileSync(SECRETS_FILE, 'utf8');
  const key1Match = content.match(/BRAVE_API_KEY_1=([A-Za-z0-9_-]+)/);
  const key2Match = content.match(/BRAVE_API_KEY_2=([A-Za-z0-9_-]+)/);
  const activeMatch = content.match(/Active:\s*(KEY_[12])/);
  if (!key1Match || !key2Match) throw new Error('Could not parse keys from .secrets.md');
  return {
    key1: key1Match[1],
    key2: key2Match[1],
    active: activeMatch ? activeMatch[1] : 'KEY_1',
  };
}

function readCurrentKey() {
  const content = fs.readFileSync(OPENCLAW_CONFIG, 'utf8');
  const m = content.match(/BRAVE_API_KEY['"]?\s*[:=]\s*['"]?([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function writeKey(newKey) {
  let content = fs.readFileSync(OPENCLAW_CONFIG, 'utf8');
  content = content.replace(
    /(BRAVE_API_KEY['"]?\s*[:=]\s*['"]?)([A-Za-z0-9_-]+)/,
    `$1${newKey}`
  );
  fs.writeFileSync(OPENCLAW_CONFIG, content, 'utf8');
}

function updateSecrets(activeLabel) {
  let content = fs.readFileSync(SECRETS_FILE, 'utf8');
  const now = new Date().toISOString().slice(0, 10);
  content = content.replace(/Active:\s*KEY_[12]/, `Active: ${activeLabel}`);
  content = content.replace(/Last rotated:\s*[\d-]+/, `Last rotated: ${now}`);
  fs.writeFileSync(SECRETS_FILE, content, 'utf8');
}

function logEvent(from, to, reason) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    event: 'brave-rotate',
    from,
    to,
    reason,
  });
  fs.appendFileSync(FAILURE_LOG, entry + '\n', 'utf8');
  console.log(`[brave-rotate] Logged: ${entry}`);
}

function restartGateway() {
  console.log('[brave-rotate] Restarting gateway...');
  try {
    execSync('openclaw gateway restart', { stdio: 'inherit' });
  } catch (e) {
    console.error('[brave-rotate] Gateway restart failed:', e.message);
  }
}

function doRotate(secrets, fromLabel, toLabel, toKey, reason) {
  console.log(`[brave-rotate] Rotating ${fromLabel} → ${toLabel} (${reason})`);
  writeKey(toKey);
  updateSecrets(toLabel);
  logEvent(fromLabel, toLabel, reason);
  restartGateway();
  console.log(`[brave-rotate] Active key: ${toLabel}`);
}

function testKey(key) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.search.brave.com',
      path: '/res/v1/web/search?q=test&count=1',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'X-Subscription-Token': key,
      },
    };
    const req = https.get(options, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

async function main() {
  const cmd = process.argv[2] || 'status';
  const secrets = readSecrets();
  const currentKey = readCurrentKey();

  if (cmd === 'status') {
    const activeKey = secrets.active === 'KEY_1' ? secrets.key1 : secrets.key2;
    const match = currentKey === activeKey ? '✓ matches openclaw.json' : '⚠ MISMATCH with openclaw.json';
    console.log(`Active: ${secrets.active} (${activeKey.slice(0, 8)}...) ${match}`);
    return;
  }

  if (cmd === 'rotate') {
    const fromLabel = secrets.active;
    const toLabel = fromLabel === 'KEY_1' ? 'KEY_2' : 'KEY_1';
    const toKey = toLabel === 'KEY_1' ? secrets.key1 : secrets.key2;
    doRotate(secrets, fromLabel, toLabel, toKey, 'manual rotate');
    return;
  }

  if (cmd === 'reset') {
    if (secrets.active === 'KEY_1' && currentKey === secrets.key1) {
      console.log('[brave-rotate] Already on KEY_1, no action needed.');
      return;
    }
    doRotate(secrets, secrets.active, 'KEY_1', secrets.key1, 'monthly reset');
    return;
  }

  if (cmd === 'check') {
    const activeKey = secrets.active === 'KEY_1' ? secrets.key1 : secrets.key2;
    console.log(`[brave-rotate] Testing ${secrets.active} (${activeKey.slice(0, 8)}...)...`);
    const status = await testKey(activeKey);
    console.log(`[brave-rotate] API response: HTTP ${status}`);

    if (status === 402) {
      const fromLabel = secrets.active;
      const toLabel = fromLabel === 'KEY_1' ? 'KEY_2' : 'KEY_1';
      const toKey = toLabel === 'KEY_1' ? secrets.key1 : secrets.key2;
      doRotate(secrets, fromLabel, toLabel, toKey, '402 monthly limit hit');
    } else if (status === 200 || status === 429) {
      console.log(`[brave-rotate] Key OK (HTTP ${status}). No rotation needed.`);
    } else {
      console.log(`[brave-rotate] Unexpected status ${status}. No rotation performed.`);
    }
    return;
  }

  console.log('Usage: node brave-rotate.js [status|rotate|reset|check]');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
