# Security

## Fail-open is the golden rule

Every guard failure path releases the tool. A bug in the gatekeeper or governor must never trap your
session or lose a pending call. Concretely:

- Governor barrier: unreadable/corrupt `state.json`, import error, or safe-cap timeout → release the call.
- Governor state `FAILED` (monitor fatal error) → `allows_execution()` returns true.
- Metrics endpoint down / 401 / 429 / 5xx → the daemon logs and continues; it does **not** pause.

## Secrets

- The code reads **all** secrets from environment variables. Nothing is hardcoded.
- Never commit `.env`, `.credentials.json`, real `settings.json`, or any state file. The provided
  `.gitignore` covers these; a pre-commit `gitleaks` hook and a CI scan are included.
- The OAuth access token is read only to call the usage endpoint and is **never logged**.
- Remote (Telegram): only the configured `chat_id` is accepted; each ask uses a one-shot nonce
  (anti-replay); silence/error/unauthorized responder falls back to a local decision.

## The internal endpoint disclaimer

The Governor reads account usage from `https://api.anthropic.com/api/oauth/usage` with the
`anthropic-beta: oauth-2025-04-20` header — an **internal, undocumented** Claude Code endpoint. It
may change, break, or be blocked without notice. This is accepted deliberately: fail-open guarantees
that if the endpoint breaks, tools keep working (they are not trapped). Use at your own risk.

## Barrier and the hook timeout

The barrier holds a call by sleeping inside the hook. It relies on Claude Code honoring a high hook
`timeout`. Measured behavior (Claude Code v2.1.x): the hook is not killed and the tool executes after
the hook returns. If a future version kills long hooks earlier, the barrier gives up at
`GOVERNOR_HOOK_WAIT_TIMEOUT_MS` (fail-open) and assisted recovery provides `claude --resume`.

## Threat model notes

- The barrier does no network I/O — it cannot be a data-exfiltration vector.
- The daemon's only outbound calls are the usage endpoint and (if enabled) Telegram.
- Input from the remote channel is authenticated (chat allowlist + nonce) before affecting decisions.

Report vulnerabilities privately to the maintainer before public disclosure.
