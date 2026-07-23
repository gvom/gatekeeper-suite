# Install

## Prerequisites

- **Python 3.9+** on PATH.
- **Claude Code** installed (`claude` CLI on PATH).
- Governor needs no extra packages (stdlib only). Gatekeeper needs the packages in `requirements.txt`.

## Install

```bash
git clone https://github.com/<you>/gatekeeper-suite.git
cd gatekeeper-suite
python install.py
```

`install.py` is idempotent and cross-platform. It will:

1. Locate your config dir (`CLAUDE_CONFIG_DIR` or `~/.claude`).
2. Copy `gatekeeper/gatekeeper.py`, the `governor/` package, and the standalone hooks
   (`governor_barrier.py`, `governor_monitor_start.py`) into `<config>/hooks/`.
3. `pip install -r requirements.txt` (gatekeeper backends).
4. **Safely merge** the hook blocks into your existing `settings.json` — it never removes your
   own hooks and never touches your existing env/keys. The write is atomic.
5. Print next steps.

## Configure

```bash
cp .env.example .env      # then fill in the keys you want (all optional to start with Ollama)
```

Set the variables in your environment (or your Claude Code `settings.json` `env` block). See
[CONFIGURATION.md](CONFIGURATION.md).

## Verify

```bash
python "<config>/hooks/gatekeeper.py" validate      # backend/keys sanity
```

In Claude Code, type `gk status` — you should see the active backend and your 5h/7d usage.

The Governor's background monitor starts automatically on the **next** Claude Code session
(via the `SessionStart` hook). The barrier is active immediately once registered.

## Uninstall

```bash
python uninstall.py
```

Removes the copied hook files and the suite's hook blocks from `settings.json` (leaving your
other hooks and env untouched). It does **not** delete your `.env` or keys.
