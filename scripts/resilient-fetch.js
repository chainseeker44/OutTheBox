#!/usr/bin/env node
/**
 * Resilient Fetch — Retry wrapper for flaky API tools
 * Usage: node scripts/resilient-fetch.js <tool> [args...]
 * 
 * Register your tools in the TOOLS object below.
 * Each tool needs: cmd (command to run), args (default args)
 */

const { execSync } = require('child_process');

const WORKSPACE = process.env.WORKSPACE_DIR || process.cwd();

const TOOLS = {
  // Example registrations — add your own:
  // 'calendar': { cmd: `node ${WORKSPACE}/tools/google-calendar/calendar.js`, args: ['2', '1'] },
  // 'gmail': { cmd: `node ${WORKSPACE}/tools/gmail/gmail.js`, args: ['recent', '10'] },
};

const tool = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!tool || !TOOLS[tool]) {
  console.log('Resilient Fetch — Retry wrapper for API tools');
  console.log(`Available tools: ${Object.keys(TOOLS).join(', ') || '(none registered — edit TOOLS object)'}`);
  process.exit(tool ? 1 : 0);
}

const t = TOOLS[tool];
const cmd = `${t.cmd} ${[...t.args, ...extraArgs].join(' ')}`;
const maxRetries = 3;

for (let i = 1; i <= maxRetries; i++) {
  try {
    if (i > 1) console.error(`[resilient-fetch] retry ${i}/${maxRetries}: ${tool}`);
    const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    console.log(JSON.stringify({
      status: 'ok', tool, attempts: i,
      data: result.trim(),
      timestamp: new Date().toISOString()
    }));
    process.exit(0);
  } catch (e) {
    if (i === maxRetries) {
      console.error(JSON.stringify({ status: 'error', tool, attempts: i, error: e.message }));
      process.exit(1);
    }
  }
}
