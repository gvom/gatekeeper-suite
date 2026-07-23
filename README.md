# gatekeeper-suite

> Two independent guards for [Claude Code](https://code.claude.com): one decides **whether** a tool
> should run, the other decides **when** — pausing before you hit your usage limit and resuming after reset.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![Python](https://img.shields.io/badge/python-3.9%2B-blue)

## What is it

A suite of two PreToolUse-based guards for Claude Code, usable together or separately:

- **Gatekeeper** — a permission guardian. Intercepts tool calls and returns *allow / ask / deny*
  using a configurable chain of LLM backends, with an autonomous mode, remote approval over
  Telegram, and in-chat commands (`gk status`, `gk auto on`).
- **Governor** — a usage-limit monitor. Watches your account's rolling usage window and, before it
  reaches 100%, **pauses all tools** by holding the current call inside the hook, then **resumes
  automatically** after the limit resets — no lost context, no model calls, no `/compact`.

Both are **fail-open**: any error in a guard releases the tool. A guard bug must never trap your session.

## Features

- **Governor**
  - Preemptive pause by usage threshold *and* by predicted time-to-100% (burn rate).
  - Universal barrier (matcher `*`) covering every tool — main agent and subagents.
  - Holds the *same* pending call and releases it after reset (no re-prompt, no model summary).
  - Atomic, versioned state machine; single-instance background monitor daemon.
  - Assisted fallback: if the hook can't outlast the reset, you get a ready `claude --resume <id>`.
  - Optional remote notifications (pause / resume / recovery) over Telegram.
- **Gatekeeper**
  - Ordered LLM backend chain (Gemini, Cerebras, OpenRouter, custom, Ollama, headless `claude -p`).
  - Autonomous mode per session; deny-with-alternative; remote authenticated ask (nonce, chat allowlist).
  - `gk status` panel: active backend, 5h/7d usage %, reset time, autonomous state.
- **Integration**: during a governor pause, the gatekeeper skips the only backend that consumes your
  account limit (`claude -p`), closing the loop.

## Architecture

```mermaid
flowchart TD
    A[Claude Code tool call] --> B[PreToolUse hooks]
    B --> C{Governor barrier<br/>state.json?}
    C -- paused --> D[sleep &amp; hold same call<br/>until reset]
    C -- running / fail-open --> E{Gatekeeper<br/>allow / ask / deny}
    E -- allow --> F[Tool runs]
    E -- ask --> G[Local prompt or Telegram]
    D -- reset detected --> E

    subgraph daemon [Governor monitor daemon]
      M[poll OAuth usage] --> N[burn rate + decision]
      N --> O[write state.json atomically]
      O -.-> C
    end
```

The **barrier** never touches the network — it only reads a local `state.json` (microseconds).
The **daemon** is the only component that polls the usage endpoint, off the critical path.

## Quickstart

```bash
git clone https://github.com/<you>/gatekeeper-suite.git
cd gatekeeper-suite
python install.py                 # copies hooks, installs deps, merges settings.json safely
cp .env.example .env              # fill in your keys (all optional to start)
python gatekeeper/gatekeeper.py validate   # sanity check
```

Then in Claude Code, type `gk status` to see your current usage and backend.

## Documentation

- [docs/INSTALL.md](docs/INSTALL.md) — install, verify, uninstall
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — every environment variable
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — decision chain & barrier internals
- [docs/SECURITY.md](docs/SECURITY.md) — threat model, fail-open, the internal-endpoint disclaimer

## License & credits

MIT © 2026 Gabriel Meneses. The Governor's OAuth usage-reading method is adapted from
[jens-duttke/usage-monitor-for-claude](https://github.com/jens-duttke/usage-monitor-for-claude) (MIT) —
see [NOTICE](NOTICE).

> ⚠️ The Governor uses an **internal, undocumented** Claude Code endpoint (`/api/oauth/usage`). It may
> change or be blocked at any time. Fail-open ensures tools keep working if it breaks. Use at your own risk.
