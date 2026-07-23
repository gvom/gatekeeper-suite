# Architecture

## Two guards, one PreToolUse chain

Both guards run as PreToolUse hooks. Order matters: the **governor barrier** is registered
first (matcher `*`), so if a pause is active it holds the call *before* the gatekeeper spends
any static/LLM analysis on a tool that shouldn't run.

```
tool call → [governor_barrier] → [gatekeeper] → tool runs
              (hold if paused)     (allow/ask/deny)
```

## Governor

Four moving parts:

1. **Monitor daemon** (`governor/monitor.py`) — the only component that touches the network.
   Launched once per install via a `SessionStart` hook (single-instance lock + PID). Each cycle it:
   fetches usage → samples burn rate → decides pause/resume → writes `state.json` atomically →
   detects real resets → signals `RESUMING → RUNNING`.

2. **Barrier** (`governor_barrier.py`) — runs on *every* tool call. It **only reads the local
   `state.json`** (microseconds, zero network). If the state is paused, it writes a mechanical
   checkpoint and `sleep`s, re-checking until the state clears, then releases the *same* call.
   It never exits with code 2, never prompts "continue", never calls the model.

3. **State machine** (`governor/state_store.py`):
   `RUNNING → PAUSE_REQUESTED → WAITING_FOR_AGENTS → PAUSED_WAITING_FOR_RESET → RESUMING → RUNNING`,
   plus `FAILED`. Writes are atomic (`tmp` + `os.replace`) and versioned. `allows_execution()` is
   **fail-open**: a missing/corrupt state, or `FAILED`, releases tools.

4. **Assisted recovery** (`governor/recovery.py`) — if the hook can't outlast the reset (safe cap
   reached, or the session restarted), the checkpoint is marked `abandoned`; on the next reset the
   monitor emits a ready `claude --resume <session_id>` (locally and, if enabled, over Telegram).
   It never kills or respawns processes.

### Decision engine

`decision.py` pauses when either:
- **threshold**: effective utilization ≥ `MAXIMUM_USAGE_PERCENTAGE`
  (effective = current + in-flight estimate), or
- **predictive**: estimated minutes-to-100% ≤ safety margin (only when enough burn-rate samples).

`reset_detector.py` treats a reset as real only when `resets_at` advances into the future, or
utilization drops by a significant margin to a low level — never on a momentary dip.

## Gatekeeper

An ordered chain of decision backends (`GATEKEEPER_BACKEND_CHAIN`): the first backend that returns a
valid `allow/ask/deny` wins. The final fallback is a headless `claude -p` (isolated, no tools, empty
settings, anti-recursion via `GATEKEEPER_INSIDE=1`).

## The integration

The headless `claude -p` backend is the *only* gatekeeper backend that consumes your **account**
limit (Gemini/Cerebras/Ollama don't). So while the governor is paused, the gatekeeper reads the
governor `state.json` and **skips the headless backend**, falling through to its fail-open/ask policy.
This stops the security guard itself from burning the limit during a pause. Fail-open: if it can't
read the governor state, it behaves as usual.
