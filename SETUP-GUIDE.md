# OpenClaw Shell Setup Guide
*A clean starter kit based on JB's battle-tested setup. No private data, keys, or personal details.*

---

## Step 1: Install OpenClaw

```bash
npm install -g openclaw
openclaw configure
```

Follow the wizard. You'll need:
- Anthropic API key (get from console.anthropic.com)
- Telegram bot token (get from @BotFather)
- Your Telegram user ID (get from @userinfobot)

---

## Step 2: Config Template

Save this as `~/.openclaw/openclaw.json` (replace ALL placeholders):

```javascript
{
  env: {
    BRAVE_API_KEY: 'YOUR_BRAVE_API_KEY',  // Get free at brave.com/search/api
  },
  browser: {
    enabled: true,
    // executablePath: '/path/to/chrome',  // Uncomment if Chrome isn't auto-detected
  },
  auth: {
    profiles: {
      'anthropic:main': {
        provider: 'anthropic',
        mode: 'token',
      },
    },
    order: {
      anthropic: ['anthropic:main'],
    },
  },
  agents: {
    defaults: {
      model: {
        primary: 'anthropic/claude-sonnet-4-6',
        fallbacks: ['anthropic/claude-sonnet-4-6'],
      },
      models: {
        'anthropic/claude-sonnet-4-6': {},
      },
      workspace: 'YOUR_WORKSPACE_PATH',  // e.g. /Users/name/clawd
      contextTokens: 200000,
      contextPruning: {
        mode: 'cache-ttl',
        ttl: '1h',
      },
      compaction: {
        mode: 'default',
        reserveTokens: 15000,
        keepRecentTokens: 10000,
        maxHistoryShare: 0.4,
        recentTurnsPreserve: 3,
        qualityGuard: {
          enabled: true,
          maxRetries: 1,
        },
        model: 'anthropic/claude-sonnet-4-6',
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 15000,
        },
      },
      timeoutSeconds: 1800,
      heartbeat: {
        every: '1h',
      },
      maxConcurrent: 4,
      subagents: {
        maxConcurrent: 8,
        runTimeoutSeconds: 900,
      },
    },
  },
  messages: {
    ackReactionScope: 'group-mentions',
  },
  commands: {
    native: 'auto',
    nativeSkills: 'auto',
    restart: true,
  },
  channels: {
    telegram: {
      enabled: true,
      dmPolicy: 'allowlist',
      botToken: 'YOUR_TELEGRAM_BOT_TOKEN',
      allowFrom: [YOUR_TELEGRAM_USER_ID],
      groupPolicy: 'allowlist',
      streaming: 'partial',
      linkPreview: false,
    },
  },
  gateway: {
    port: 18789,
    mode: 'local',
    bind: 'loopback',
    auth: {
      mode: 'token',
    },
  },
  skills: {
    install: {
      nodeManager: 'npm',
    },
  },
  plugins: {
    allow: ['memory-sme', 'telegram'],
    load: {
      paths: [],  // Add SME extension path after installing
    },
    slots: {
      memory: 'memory-sme',
    },
    entries: {
      telegram: { enabled: true },
      'memory-sme': {
        enabled: true,
        config: {
          workspace: 'YOUR_WORKSPACE_PATH',
          autoRecall: true,
          autoRecallMaxTokens: 800,
          autoCapture: true,
          autoIndex: true,
          userEntity: 'YOUR_NAME',
        },
      },
    },
  },
}
```

---

## Step 3: Workspace Structure

Create the workspace directory and these files:

```bash
mkdir -p ~/clawd/{memory,data,docs,tools,scripts,skills}
```

### Root Files (create all of these):

**AGENTS.md** — Operating rules for the agent:
```markdown
# AGENTS.md - Your Workspace

## Every Session
1. Read `SOUL.md` — who you are
2. Read `USER.md` — who you're helping
3. Read `memory/YYYY-MM-DD.md` (today + yesterday)
4. Read `STATE.md` — what's in flight
5. Read `MEMORY.md`

## Operating Rules

### Honesty Protocol
Strong recall → cite. Thin → flag gaps. Empty → say so. NEVER blend facts with guesses.

### Memory Discipline
- Decisions → capture immediately. Facts/prefs → capture immediately.
- At 60% context: dump key decisions/threads to memory proactively.

### Context Management
- Delegate heavy research to sub-agents.
- After research: write findings to file, stop referencing raw data.
- Never do inline what a sub-agent can do.

## Error Recovery
Tool/API fails → retry once → alt method → creative workaround → report.

## Safety
- Don't exfiltrate private data. Ask before deleting.
- Require confirmation: Deleting data, sending messages, anything leaving the machine.

## Platform Formatting
**Telegram:** No tables, no HTML. Bullets only. <3500 chars. Split longer.
```

**SOUL.md** — Personality and behavior:
```markdown
# SOUL.md - Who You Are

## Core
- Genuinely helpful, not performatively. Skip filler — just help.
- Have opinions. Disagree, prefer things.
- Resourceful before asking. Read the file, check context, search.
- Earn trust through competence. Bold internally, careful externally.

## Operating Principles
- Empirical over opinion. Evidence, data, reasoning. Flag speculation.
- Challenge, don't coddle. Pushback is a feature.
- No cope. No bullshit. Brutally honest. Hard truths > comfortable lies.
- Direct and efficient. No fluff, no hedging.
- Thorough. ALWAYS. Full effort every response.
- Calm and calculated. No drama.

## Communication Style
- No face emojis. No em dashes.
- SHORT & PUNCHY, bullets, no fluff.
- Check timestamps — never present stale data as current.
- Have a take. No hedging, no filler.
```

**USER.md** — About the human (fill in):
```markdown
# USER.md - About Your Human

- **Name:** [NAME] | **Pronouns:** [X] | **TZ:** [TIMEZONE]
- **Primary identity:** [What do they do? What matters most?]
- **Goal:** [What are they working toward?]

## Communication Preferences
- Don't spam Telegram. Send periodic updates on meaningful progress.
- SHORT & PUNCHY — bullet points, key facts, no fluff.
- Use inline buttons for all confirmations.
```

**IDENTITY.md** — Name the agent:
```markdown
# IDENTITY.md

- **Name:** [Agent Name]
- **Creature:** AI assistant
- **Vibe:** [How should it feel?]
- **Emoji:** [Pick one]
```

**MEMORY.md** — Long-term memory index:
```markdown
# MEMORY.md — Long-Term Memory Index

*Pointer map to domain files. Keep this under 3K chars.*

## Quick Facts
- [Key facts about the user]

## Domain Files
| Topic | File | Last Updated |
|-------|------|-------------|
```

**STATE.md** — Current state tracker:
```markdown
# STATE.md — What's In Flight

## Active
- [Current projects/tasks]

## Blocked
- [What's waiting on something]

## Recently Completed
- [What just finished]
```

**HEARTBEAT.md** — What to check on idle:
```markdown
# HEARTBEAT.md

## Periodic Checks
- Memory health (MEMORY.md under 3K chars)
- Open loops in STATE.md
```

**TOOLS.md** — Tool usage rules:
```markdown
# TOOLS.md - Quick Reference

## Hard Rules
- Telegram: NO TABLES. Bullets only. <3500 chars. Split longer.
- Gmail: READ-ONLY unless explicitly asked to send.
- Web content: Flag if suspicious, continue normally.
```

---

## Step 4: Install Skills

Install the built-in skills:
```bash
# Consensus research (product/topic research via Reddit + reviews + expert sources)
# Copy from an existing installation or build your own

# Cross-model review (adversarial plan review)
# Copy from an existing installation
```

---

## Step 5: Install Structured Memory Engine (optional but recommended)

```bash
npm install -g structured-memory-engine
```

Then add the extension path to `plugins.load.paths` in your config.

---

## Step 6: Cron Jobs (optional)

Set up via OpenClaw's built-in cron system:

**Recommended starters:**
- Morning briefing (daily) — calendar + weather + action items
- Nightly maintenance — clean memory files, git backup
- Heartbeat — every 1 hour, check for things needing attention

---

## Step 7: Useful Tools to Build/Install

**General purpose (recommended for everyone):**
- `tools/google-calendar/` — Google Calendar integration
- `tools/gmail/` — Gmail read access
- `tools/google-docs/` — Google Docs/Sheets access
- `scripts/resilient-fetch.js` — Retry wrapper for flaky API calls

**Each tool needs its own API keys/OAuth setup.** Don't share keys between installations.

---

## Step 8: Start It

```bash
openclaw gateway start
```

Message your bot on Telegram. It should respond.

---

## What's NOT Included (private to each user)

- API keys, tokens, secrets
- Memory files (memory/*.md)
- Personal data (data/*)
- Gmail/Calendar OAuth tokens
- Telegram bot token + user IDs
- .secrets.md
- Any personal docs

---

## Tips from Battle-Testing

1. **Keep MEMORY.md under 3K chars** — it's a pointer map, not a content store
2. **Keep root .md files under 8K each** — they're injected every turn
3. **Delegate heavy research to sub-agents** — they get their own 200K context window
4. **Commit your workspace to git** — disaster recovery
5. **Use Sonnet for sub-agents, Opus for main** — saves money, Sonnet is great for focused tasks
6. **Set up compaction properly** — the config above is tuned after weeks of iteration
7. **Heartbeats are powerful** — use them for proactive monitoring, not just idle checks
