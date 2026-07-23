# Configuration

All configuration is via environment variables. Nothing is hardcoded.

## Gatekeeper (permission guard)

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEKEEPER_BACKEND` | `ollama` | Primary LLM backend. |
| `GATEKEEPER_BACKEND_CHAIN` | — | Ordered CSV chain, e.g. `gemini,ollama`. Overrides the single backend. |
| `GATEKEEPER_FALLBACK_BACKEND` | `ollama` | Backend used when the chain is exhausted. |
| `GATEKEEPER_FALLBACK_ENABLED` | `true` | Enable the fallback backend. |
| `GATEKEEPER_CEREBRAS_API_KEY` | — | Cerebras key (free tier available). |
| `GATEKEEPER_GEMINI_API_KEY` | — | Google Gemini key (free tier available). |
| `OPENROUTER_API_KEY` | — | OpenRouter key (has free models). |
| `GATEKEEPER_CUSTOM_URL` / `_API_KEY` / `_MODEL` | — | OpenAI-compatible custom endpoint. |
| `GATEKEEPER_CLAUDE_HEADLESS` | `true` | Allow the headless `claude -p` fallback (consumes account limit). |
| `GATEKEEPER_SMART_REVIEW` | `true` | Enable smarter static+LLM review. |
| `GATEKEEPER_FAILOPEN_MAX_RISK` | `medium` | Max risk tier auto-allowed on guard failure. |

### Getting free keys

- **Gemini**: https://aistudio.google.com/apikey
- **Cerebras**: https://cloud.cerebras.ai (free tier)
- **OpenRouter**: https://openrouter.ai/keys (free models like `:free`)
- **Ollama** (fully local, no key): https://ollama.com

## Remote (Telegram) — shared by gatekeeper & governor

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEKEEPER_REMOTE` | — | Set to `telegram` to enable remote ask/notify. |
| `GATEKEEPER_REMOTE_TOKEN` | — | Telegram bot token. |
| `GATEKEEPER_REMOTE_CHAT_ID` | — | Authorized chat id (the only accepted responder). |
| `GATEKEEPER_REMOTE_TIMEOUT` | `60` | Seconds to wait for a remote answer. |

Create a bot with @BotFather, get your chat id (e.g. via @userinfobot), then set the three vars.

## Governor (usage-limit monitor)

| Variable | Default | Description |
|----------|---------|-------------|
| `GOVERNOR_MONITORING_INTERVAL_MS` | `30000` | Daemon polling interval. |
| `GOVERNOR_MAXIMUM_USAGE_PERCENTAGE` | `95` | Pause when usage reaches this %. |
| `GOVERNOR_MINIMUM_AVAILABLE_PERCENTAGE_TO_RESUME` | `50` | Min free capacity to resume (or a real reset). |
| `GOVERNOR_SAFETY_MARGIN_MS` | `120000` | Predictive safety margin. |
| `GOVERNOR_BURN_RATE_WINDOW_MS` | `600000` | Moving window for burn-rate. |
| `GOVERNOR_MINIMUM_SAMPLES_FOR_PREDICTION` | `3` | Below this, predictive rule is skipped. |
| `GOVERNOR_MAX_ESTIMATED_USAGE_PER_IN_FLIGHT_REQUEST` | `1.0` | Conservative % per in-flight call. |
| `GOVERNOR_RESET_MIN_UTILIZATION_DROP` | `20.0` | Min utilization drop (pts) to count as a reset. |
| `GOVERNOR_HEARTBEAT_INTERVAL_MS` | `900000` | Min interval between "still paused" heartbeat notifications (remote). |
| `GOVERNOR_INFLIGHT_DIR_PATH` | `<config>/governor/inflight` | Dir of in-flight tool-call markers. |
| `GOVERNOR_INFLIGHT_TTL_MS` | `300000` | Max marker age before it's pruned (orphan cleanup). |
| `GOVERNOR_HOOK_WAIT_TIMEOUT_MS` | `21000000` | Barrier safe cap (< the hook `timeout`). |
| `GOVERNOR_RESET_CHECK_INTERVAL_MS` | `15000` | Barrier re-check interval while paused. |
| `GOVERNOR_METRICS_CACHE_TTL_MS` | `15000` | Usage metrics cache TTL. |
| `GOVERNOR_STATE_FILE_PATH` | `<config>/governor/state.json` | State file path. |
| `GOVERNOR_CHECKPOINT_PATH` | `<config>/governor/checkpoint.json` | Checkpoint path. |
| `GOVERNOR_LOCK_FILE_PATH` | `<config>/governor/monitor.lock` | Daemon single-instance lock. |
| `GOVERNOR_LOG_FILE_PATH` | `<config>/governor/governor.log` | Log path. |

The hook `timeout` in `settings.json` (e.g. `21600` seconds) must stay **above**
`GOVERNOR_HOOK_WAIT_TIMEOUT_MS / 1000` so the barrier gives up (fail-open) before Claude Code
would kill the hook.

## In-chat commands (gatekeeper)

- `gk status` — backend chain + 5h/7d usage % + reset time + autonomous state.
- `gk auto on|off|status` — toggle autonomous mode for the session.

## Notes & known limitations

- **Session state is per-install, not per-window.** The gatekeeper keeps a single
  `gatekeeper_session.json` under the config dir, shared by all open Claude Code windows;
  autonomous mode is therefore effectively per-install. For the Governor this is correct —
  the usage limit is per-**account**, so global state is the right scope.
- **In-flight consumption is fed to the decision engine.** A PreToolUse marker (written by the
  barrier when a tool is released to run) and a PostToolUse hook (`governor_inflight_end.py`,
  removes the oldest marker) maintain an approximate count of concurrently-running tool calls.
  The daemon adds `count * GOVERNOR_MAX_ESTIMATED_USAGE_PER_IN_FLIGHT_REQUEST` to the effective
  utilization. Markers older than `GOVERNOR_INFLIGHT_TTL_MS` are pruned (orphan cleanup). Since
  PreToolUse has no `tool_use_id`, pairing is FIFO/best-effort — a deliberate approximation.
- **Live end-to-end pause→resume and the subagent barrier** rely on Claude Code honoring a long
  hook `timeout`; measured on v2.1.x (a 900s hold was not killed). Behavior may change in future
  Claude Code versions — fail-open and assisted `--resume` are the safety nets.
