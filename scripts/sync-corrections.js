#!/usr/bin/env node
/**
 * sync-corrections.js — Corrections → VOICE.md Pipeline
 * 
 * Reads .corrections.json and syncs all corrections into VOICE.md
 * so they're impossible to miss at session start.
 * 
 * Usage:
 *   node scripts/sync-corrections.js           # sync corrections to VOICE.md
 *   node scripts/sync-corrections.js add "pattern" "correction" ["context"]
 *   node scripts/sync-corrections.js list       # show all corrections
 *   node scripts/sync-corrections.js stats      # show correction stats
 * 
 * Run after adding corrections, or as part of nightly build.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKSPACE = process.env.WORKSPACE_DIR || path.join(__dirname, '..');
const CORRECTIONS_FILE = path.join(WORKSPACE, '.corrections.json');
const VOICE_FILE = path.join(WORKSPACE, 'VOICE.md');

// Markers in VOICE.md for the auto-generated section
const SECTION_START = '<!-- CORRECTIONS_AUTO_START -->';
const SECTION_END = '<!-- CORRECTIONS_AUTO_END -->';

function loadCorrections() {
  try {
    return JSON.parse(fs.readFileSync(CORRECTIONS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveCorrections(corrections) {
  fs.writeFileSync(CORRECTIONS_FILE, JSON.stringify(corrections, null, 2));
}

function generateId(pattern, correction) {
  const content = `${pattern.toLowerCase().trim()}:${correction.toLowerCase().trim()}`;
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

function categorize(correction) {
  // Use explicit category if set (from add --category)
  if (correction.category) return correction.category;
  
  const text = `${correction.pattern} ${correction.correction}`.toLowerCase();
  
  // Order matters: most specific first, broadest last
  // Safety/security — highest priority category
  if (text.includes('approval') || text.includes('destructive') || text.includes('delete') || 
      text.includes('install') || text.includes('update') || text.includes('execute') ||
      text.includes('permission') || text.includes('security'))
    return 'safety';
  
  // Behavioral — how I operate
  if (text.includes('defer') || text.includes('table this') || text.includes('later') ||
      text.includes('give up') || text.includes('failure') || text.includes('retry') ||
      text.includes('lazy') || text.includes('surface') || text.includes('thorough') ||
      text.includes('effort') || text.includes('half-ass'))
    return 'behavior';
  
  // Data handling
  if (text.includes('stale') || text.includes('timestamp') || text.includes('freshness') ||
      text.includes('old data') || text.includes('cached'))
    return 'data';
  
  // Telegram/messaging — delivery mechanics
  if (text.includes('telegram') || text.includes('button') || text.includes('inline') ||
      text.includes('message tool') || text.includes('no_reply'))
    return 'messaging';
  
  // Formatting — visual presentation
  if (text.includes('html') || text.includes('table') || text.includes('markdown') ||
      text.includes('format'))
    return 'formatting';
  
  // Trading/crypto
  if (text.includes('wallet') || text.includes('trading') || text.includes('token') ||
      text.includes('chain') || text.includes('crypto'))
    return 'trading';
  
  return 'general';
}

function formatCorrectionsForVoice(corrections) {
  // Group by category
  const groups = {};
  for (const c of corrections) {
    const cat = categorize(c);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(c);
  }

  // Render order: critical categories first
  const categoryOrder = ['safety', 'behavior', 'data', 'messaging', 'formatting', 'trading', 'general'];
  
  const categoryLabels = {
    safety: '🛡️ Safety',
    behavior: '⚡ Behavior',
    messaging: '💬 Telegram Delivery',
    trading: '📊 Trading',
    data: '📈 Data',
    formatting: '🎨 Formatting',
    general: '🔧 General'
  };

  let output = `${SECTION_START}\n`;
  output += `## Corrections (auto-synced, ${corrections.length} tracked)\n\n`;

  // Compact format: category header + condensed one-liners
  for (const cat of categoryOrder) {
    const items = groups[cat];
    if (!items || items.length === 0) continue;
    output += `**${categoryLabels[cat] || cat}:**`;
    if (items.length === 1) {
      output += ` ${items[0].correction}\n`;
    } else {
      output += '\n';
      for (const item of items) {
        output += `- ${item.correction}\n`;
      }
    }
    output += '\n';
  }
  
  // Catch any uncategorized
  for (const [cat, items] of Object.entries(groups)) {
    if (!categoryOrder.includes(cat)) {
      output += `**${cat}:**\n`;
      for (const item of items) {
        output += `- ${item.correction}\n`;
      }
      output += '\n';
    }
  }

  output += SECTION_END;
  return output;
}

function syncToVoice(corrections) {
  let voice = fs.readFileSync(VOICE_FILE, 'utf8');
  
  const formatted = formatCorrectionsForVoice(corrections);
  
  // Check if auto section exists
  const startIdx = voice.indexOf(SECTION_START);
  const endIdx = voice.indexOf(SECTION_END);
  
  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing section
    voice = voice.slice(0, startIdx) + formatted + voice.slice(endIdx + SECTION_END.length);
  } else {
    // Find the manual corrections section and replace/append after it
    const manualHeader = '## Corrections Log';
    const manualIdx = voice.indexOf(manualHeader);
    
    if (manualIdx !== -1) {
      // Find the next ## header after corrections log
      const nextHeaderIdx = voice.indexOf('\n## ', manualIdx + manualHeader.length);
      if (nextHeaderIdx !== -1) {
        // Insert before next section
        voice = voice.slice(0, nextHeaderIdx) + '\n\n' + formatted + '\n' + voice.slice(nextHeaderIdx);
      } else {
        // Append at end
        voice += '\n\n' + formatted;
      }
    } else {
      // No corrections section exists, append
      voice += '\n\n' + formatted;
    }
  }
  
  fs.writeFileSync(VOICE_FILE, voice);
  return corrections.length;
}

function addCorrection(pattern, correction, context, category) {
  const corrections = loadCorrections();
  
  // Check for duplicates
  const id = generateId(pattern, correction);
  if (corrections.find(c => c.id === id)) {
    console.log(`Duplicate correction (${id}), skipping.`);
    return id;
  }
  
  // Input validation
  if (!pattern || pattern.trim().length < 3) {
    console.error('Pattern must be at least 3 characters.');
    return null;
  }
  if (!correction || correction.trim().length < 3) {
    console.error('Correction must be at least 3 characters.');
    return null;
  }
  
  const newCorrection = {
    id,
    pattern: pattern.trim(),
    correction: correction.trim(),
    context: context ? context.trim() : null,
    category: category || null, // explicit category override
    timestamp: new Date().toISOString(),
    appliedCount: 0,
    lastApplied: null,
    source: 'sync-corrections.js'
  };
  
  corrections.push(newCorrection);
  saveCorrections(corrections);
  
  // Auto-sync to VOICE.md
  syncToVoice(corrections);
  
  console.log(`Added correction ${id} (${categorize(newCorrection)}) and synced to VOICE.md`);
  return id;
}

function removeCorrection(idOrPattern) {
  const corrections = loadCorrections();
  const before = corrections.length;
  
  const filtered = corrections.filter(c => {
    if (c.id === idOrPattern) return false;
    if (c.pattern.toLowerCase().includes(idOrPattern.toLowerCase())) return false;
    return true;
  });
  
  const removed = before - filtered.length;
  if (removed === 0) {
    console.log(`No corrections matching "${idOrPattern}" found.`);
    return;
  }
  
  saveCorrections(filtered);
  syncToVoice(filtered);
  console.log(`Removed ${removed} correction(s) and synced to VOICE.md`);
}

function listCorrections() {
  const corrections = loadCorrections();
  if (corrections.length === 0) {
    console.log('No corrections tracked.');
    return;
  }
  
  console.log(`\n📋 ${corrections.length} corrections tracked:\n`);
  for (const c of corrections) {
    const cat = categorize(c);
    const date = c.timestamp.split('T')[0];
    console.log(`[${c.id}] (${cat}) ${date}`);
    console.log(`  ❌ ${c.pattern}`);
    console.log(`  ✅ ${c.correction}`);
    if (c.context) console.log(`  💡 ${c.context}`);
    console.log();
  }
}

function showStats() {
  const corrections = loadCorrections();
  const groups = {};
  for (const c of corrections) {
    const cat = categorize(c);
    groups[cat] = (groups[cat] || 0) + 1;
  }
  
  console.log(`\n📊 Correction Stats:`);
  console.log(`Total: ${corrections.length}`);
  for (const [cat, count] of Object.entries(groups)) {
    console.log(`  ${cat}: ${count}`);
  }
  
  const oldest = corrections.reduce((a, b) => a.timestamp < b.timestamp ? a : b, corrections[0]);
  const newest = corrections.reduce((a, b) => a.timestamp > b.timestamp ? a : b, corrections[0]);
  if (oldest) console.log(`\nOldest: ${oldest.timestamp.split('T')[0]} — "${oldest.pattern}"`);
  if (newest) console.log(`Newest: ${newest.timestamp.split('T')[0]} — "${newest.pattern}"`);
}

// CLI
const args = process.argv.slice(2);
const command = args[0] || 'sync';

// Parse --category flag from args
function extractFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    const val = args[idx + 1];
    args.splice(idx, 2);
    return val;
  }
  return null;
}

const category = extractFlag(args, '--category');

switch (command) {
  case 'sync': {
    const corrections = loadCorrections();
    const count = syncToVoice(corrections);
    console.log(`✅ Synced ${count} corrections to VOICE.md`);
    break;
  }
  case 'add': {
    if (args.length < 3) {
      console.error('Usage: sync-corrections.js add "pattern" "correction" ["context"] [--category safety|behavior|messaging|...]');
      process.exit(1);
    }
    addCorrection(args[1], args[2], args[3], category);
    break;
  }
  case 'remove': {
    if (args.length < 2) {
      console.error('Usage: sync-corrections.js remove <id-or-pattern-substring>');
      process.exit(1);
    }
    removeCorrection(args[1]);
    break;
  }
  case 'list':
    listCorrections();
    break;
  case 'stats':
    showStats();
    break;
  default:
    console.error(`Unknown command: ${command}. Available: sync, add, remove, list, stats`);
    process.exit(1);
}
