# OutTheBox 📦

A ready-to-go workspace shell for [OpenClaw](https://docs.openclaw.ai) — the AI agent framework.

Drop this into your workspace and start chatting. Everything is pre-structured with best practices baked in: memory management, context anti-bloat, tool wrappers, research skills, and productivity integrations.

## Quick Start

```bash
# Clone into your workspace
cd ~/clawd
git clone https://github.com/chainseeker44/OutTheBox.git .

# Or if you already have a workspace:
git clone https://github.com/chainseeker44/OutTheBox.git /tmp/outthebox
cp -r /tmp/outthebox/* ~/clawd/

# Run the bootstrap
bash bootstrap.sh

# Fill in your details
# Edit USER.md, IDENTITY.md, and MEMORY.md
```

## 📖 Read the Playbook

**[PLAYBOOK.md](PLAYBOOK.md)** — The complete guide to running OpenClaw effectively. Covers workspace architecture, memory system, corrections loop, security, cron jobs, sub-agent delegation, and daily workflow patterns. Read this first.

## What's Inside

### Root Files (the brain)
| File | Purpose |
|------|---------|
| `AGENTS.md` | Agent behavior rules, memory discipline, safety |
| `SOUL.md` | Personality, communication style, operating principles |
| `USER.md` | About you — fill in your details |
| `IDENTITY.md` | Name your agent, pick a vibe |
| `MEMORY.md` | Long-term memory index (pointer map) |
| `STATE.md` | Active projects, blocked items, recently completed |
| `HEARTBEAT.md` | Periodic health checks and maintenance tasks |
| `TOOLS.md` | Tool quick-reference and hard rules |
| `VOICE.md` | Communication corrections tracker |

### Skills
- **consensus-research/** — Multi-source product and topic research. Blends expert reviews, Reddit, and verified purchases. The agent runs this automatically when you ask it to research something.

### Tools
- **gmail/** — Read-only Gmail access via Google API. Supports multiple accounts.
- **google-calendar/** — Calendar read/write. Personal + work merged view.
- **google-docs/** — Google Docs and Sheets access.
- **flight-search/** — Flight search with 8+ strategies (hidden city, award flights, geo-pricing, etc).
- **food-guide/** — Local restaurant guide framework. Add your spots.

### Scripts
- **resilient-fetch.js** — Retry wrapper for flaky API tools. Register your tools and get automatic retries.
- **brave-rotate.js** — Brave Search API key rotation (free tier management).
- **brave-check.sh** — Quick Brave API key health check.
- **correction-tracker.py** — Tracks and syncs voice/behavior corrections to SOUL.md.
- **sync-corrections.js** — Auto-syncs corrections block.

### Directories (created by bootstrap.sh)
```
memory/          — Daily memory logs (YYYY-MM-DD.md)
data/            — Domain-specific data files
docs/            — Documentation and reference material
tools/           — API integrations and CLI tools
scripts/         — Utility scripts
skills/          — Agent skills (research, analysis, etc)
archive/         — Old/completed items
logs/            — Tool and session logs
```

## Setup Tools

Most tools need OAuth credentials from Google Cloud Console:

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable Gmail, Calendar, and Docs APIs
3. Create OAuth 2.0 credentials (Desktop app)
4. Download `credentials.json` into each tool directory
5. Run the auth flow: `node tools/gmail/gmail.js auth`

## Philosophy

- **Memory files ARE your agent's memory.** It wakes fresh every session. These files are continuity.
- **Root files stay small.** <8KB each, <20KB total. Move details to `docs/` or `data/`.
- **Delegate heavy work.** Sub-agents get their own context window. Don't bloat the main session.
- **Earn trust through competence.** The agent should be resourceful before asking questions.
- **Honest > comfortable.** Hard truths, evidence-based, no cope.

## Contributing

This is a community shell. If you build a useful tool or skill, open a PR.

## License

MIT
