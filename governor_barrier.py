#!/usr/bin/env python
"""
governor_barrier.py — barreira universal PreToolUse (GOVERNOR_PLAN.md §5).

Registrar (quando ativar) com matcher `*` ANTES do gatekeeper (§14.2) e timeout alto.
Só LÊ o state.json local (microssegundos, ZERO rede — §14.3). Quando pausado, segura
(sleep) a MESMA chamada e a libera após o reset. NUNCA exit 2, prompt "continue",
/compact, resumo do modelo, nem cancela a chamada.

FAIL-OPEN em tudo: qualquer erro → exit 0 (libera a ferramenta).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from typing import Callable, Optional

HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))
if HOOKS_DIR not in sys.path:
    sys.path.insert(0, HOOKS_DIR)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _git(cwd: str, *args: str) -> Optional[str]:
    try:
        out = subprocess.run(
            ["git", *args], cwd=cwd, capture_output=True, timeout=5, text=True
        )
        if out.returncode == 0:
            return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return None


def _repo_info(cwd: Optional[str]) -> dict:
    if not cwd or not os.path.isdir(cwd):
        return {"path": cwd, "branch": None, "commit": None, "dirty": None}
    branch = _git(cwd, "rev-parse", "--abbrev-ref", "HEAD")
    commit = _git(cwd, "rev-parse", "HEAD")
    status = _git(cwd, "status", "--porcelain")
    return {
        "path": cwd,
        "branch": branch,
        "commit": commit,
        "dirty": (bool(status) if status is not None else None),
    }


def write_checkpoint(config, data: dict, tool_name: str) -> None:
    """
    Checkpoint MECÂNICO (só dados de runtime, sem análise semântica).
    agentId/toolUseId NÃO existem no PreToolUse → omitidos. Best-effort, fail-open.
    """
    try:
        payload = {
            "sessionId": data.get("session_id"),
            "transcriptPath": data.get("transcript_path"),
            "pausedAt": _now_iso(),
            "pauseReason": "usage_limit",
            "status": "waiting",  # waiting|abandoned|resumed (governor.recovery)
            "repository": _repo_info(data.get("cwd")),
            "blockedExecutions": [{"tool": tool_name, "status": "waiting"}],
        }
        path = config.checkpoint_path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".ckpt-", suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except Exception:
        pass  # checkpoint é best-effort; nunca falha o guard


def _recovery_manager(config):
    try:
        from governor.recovery import SessionRecoveryManager

        return SessionRecoveryManager(config)
    except Exception:
        return None


def run(
    data: dict,
    *,
    env: Optional[dict] = None,
    store=None,
    config=None,
    recovery=None,
    sleep_fn: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> int:
    """
    Núcleo da barreira. Retorna o exit code (sempre 0 — fail-open ou liberação).
    Deps injetáveis para teste (env, store, config, sleep_fn, clock).
    """
    env = env if env is not None else os.environ

    # Anti-recursão: subagente headless (claude -p) do gatekeeper não deve ser barrado.
    if env.get("GATEKEEPER_INSIDE") == "1":
        return 0

    # Import + leitura de estado, tudo fail-open.
    try:
        if config is None or store is None:
            from governor.config import load_config
            from governor.state_store import GlobalPauseStateStore

            config = config or load_config()
            store = store or GlobalPauseStateStore(config)
        state = store.read()
    except Exception:
        return 0  # fail-open: sem estado legível → libera

    if state.allows_execution():
        return 0

    # Pausado: registra checkpoint mecânico e segura a MESMA chamada.
    tool_name = data.get("tool_name", "unknown")
    write_checkpoint(config, data, tool_name)
    if recovery is None:
        recovery = _recovery_manager(config)

    interval = max(0.001, config.reset_check_interval_ms / 1000.0)
    cap_seconds = config.hook_wait_timeout_ms / 1000.0
    started = clock()

    while state.is_paused():
        if (clock() - started) >= cap_seconds:
            # Teto seguro atingido antes do reset → fail-open + marca hook-morto (recovery).
            if recovery is not None:
                try:
                    recovery.mark_abandoned()
                except Exception:
                    pass
            return 0
        sleep_fn(interval)
        try:
            state = store.read()
        except Exception:
            return 0  # fail-open

    # reset detectado (RUNNING/RESUMING) → libera a MESMA chamada
    if recovery is not None:
        try:
            recovery.mark_resumed()
        except Exception:
            pass
    return 0


def main() -> int:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw and raw.strip() else {}
    except Exception:
        return 0  # fail-open
    if not isinstance(data, dict):
        return 0
    return run(data)


if __name__ == "__main__":
    sys.exit(main())
