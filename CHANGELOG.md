# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-07-23

### Added
- **Gatekeeper autonomous resolver** with named execution floors. In autonomous mode, `ask`/`deny`
  decisions are resolved with no human: **approve**, **rewrite** (transparent via the PreToolUse
  `updatedInput`, or `deny`+alternative for the model to self-correct — re-validated by the static
  risk classifier), or **stop**. A deterministic floor (`strict` default | `balanced` | `open`,
  with aliases `1/2/3`, `safe`, `yolo`/`unsafe`) hard-stops non-negotiable categories before the
  resolver; low/medium keep the classic fast path (allow, no LLM); resolver failure fails safe to `ask`.
- New in-chat commands: `gk floor [level]` and `gk help`; `gk auto on [level]` and the `gk auto <level>`
  shortcut; `gk status` now shows the active floor. New env `GATEKEEPER_AUTO_FLOOR`.

### Fixed
- Test module now resolves `gatekeeper.py` by sibling path (portable across install locations / CI).

## [1.0.0] — 2026-07-23

### Added
- **Gatekeeper** (v8.2): permission guardian for Claude Code — allow/ask/deny
  decisions via a configurable LLM backend chain (Gemini, Cerebras, OpenRouter,
  custom, Ollama, headless `claude -p`), autonomous mode, remote ask over Telegram,
  and the `gk status` / `gk auto` in-chat commands.
- **Governor**: usage-limit monitor with automatic pause/resume.
  - Metrics via the internal OAuth usage endpoint (short cache, fail-open).
  - Burn-rate + predictive pause decision engine.
  - Atomic, versioned global state machine.
  - Universal PreToolUse barrier that holds the same tool call until reset.
  - Assisted recovery (`claude --resume <id>`) when the hook cannot outlast the reset.
  - Optional remote notifications reusing the gatekeeper's Telegram channel.
- Cross-platform installer/uninstaller, example config, docs, and CI.

### Integration
- The gatekeeper skips the account-consuming headless `claude -p` backend while
  the governor is paused.
