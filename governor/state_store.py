"""
governor.state_store — estado global de pausa (GOVERNOR_PLAN.md §6).

state.json escrito ATÔMICO (tmp + os.replace), com `version` incremental e
transições idempotentes. Máquina de estados:

  RUNNING → PAUSE_REQUESTED → WAITING_FOR_AGENTS → PAUSED_WAITING_FOR_RESET
          → RESUMING → RUNNING ;  FAILED em erro fatal do monitor.

REGRA FAIL-OPEN: estado ausente/corrompido → allows_execution() == True.
A barreira só LÊ este arquivo (microssegundos, sem rede — §14.3).
"""
from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Optional

from .config import GovernorConfig, load_config

# --- estados ---------------------------------------------------------------
RUNNING = "RUNNING"
PAUSE_REQUESTED = "PAUSE_REQUESTED"
WAITING_FOR_AGENTS = "WAITING_FOR_AGENTS"
PAUSED_WAITING_FOR_RESET = "PAUSED_WAITING_FOR_RESET"
RESUMING = "RESUMING"
FAILED = "FAILED"

VALID_STATES = frozenset(
    {RUNNING, PAUSE_REQUESTED, WAITING_FOR_AGENTS, PAUSED_WAITING_FOR_RESET, RESUMING, FAILED}
)

# Estados em que a execução é liberada. Tudo o mais (pausa) bloqueia.
# FAILED entra aqui por FAIL-OPEN: monitor com erro fatal NÃO pode prender a sessão.
_EXECUTION_ALLOWED_STATES = frozenset({RUNNING, RESUMING, FAILED})

# Estados em que a barreira deve segurar a ferramenta.
_PAUSED_STATES = frozenset({PAUSE_REQUESTED, WAITING_FOR_AGENTS, PAUSED_WAITING_FOR_RESET})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class GovernorState:
    state: str = RUNNING
    reason: Optional[str] = None
    usage_percentage: Optional[float] = None
    remaining_usage: Optional[float] = None
    detected_at: Optional[str] = None
    expected_reset_at: Optional[str] = None
    updated_at: Optional[str] = None
    version: int = 0
    # True quando o estado foi sintetizado por falha de leitura (fail-open).
    synthetic_fail_open: bool = False

    # -- consultas ----------------------------------------------------------
    def allows_execution(self) -> bool:
        # fail-open: estado sintético (ausente/corrompido) libera.
        if self.synthetic_fail_open:
            return True
        return self.state in _EXECUTION_ALLOWED_STATES

    def is_paused(self) -> bool:
        if self.synthetic_fail_open:
            return False
        return self.state in _PAUSED_STATES

    # -- serialização -------------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "state": self.state,
            "paused": self.is_paused(),
            "reason": self.reason,
            "usagePercentage": self.usage_percentage,
            "remainingUsage": self.remaining_usage,
            "detectedAt": self.detected_at,
            "expectedResetAt": self.expected_reset_at,
            "updatedAt": self.updated_at,
            "version": self.version,
        }

    @staticmethod
    def from_dict(d: dict) -> "GovernorState":
        state = d.get("state", RUNNING)
        if state not in VALID_STATES:
            # Estado desconhecido → tratar como fail-open (não travar por corrupção).
            return GovernorState(synthetic_fail_open=True)
        return GovernorState(
            state=state,
            reason=d.get("reason"),
            usage_percentage=d.get("usagePercentage"),
            remaining_usage=d.get("remainingUsage"),
            detected_at=d.get("detectedAt"),
            expected_reset_at=d.get("expectedResetAt"),
            updated_at=d.get("updatedAt"),
            version=int(d.get("version", 0) or 0),
        )


def _fail_open_state() -> GovernorState:
    return GovernorState(state=RUNNING, synthetic_fail_open=True)


class GlobalPauseStateStore:
    """Leitura/escrita atômica do state.json global."""

    def __init__(self, config: Optional[GovernorConfig] = None):
        self._config = config or load_config()
        self._path = self._config.state_file_path

    @property
    def path(self) -> str:
        return self._path

    # -- leitura (usada pela barreira; NUNCA levanta) -----------------------
    def read(self) -> GovernorState:
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            return _fail_open_state()
        except (OSError, ValueError):
            # Corrompido / escrita parcial → fail-open.
            return _fail_open_state()
        if not isinstance(data, dict):
            return _fail_open_state()
        return GovernorState.from_dict(data)

    # -- escrita atômica ----------------------------------------------------
    def _write_atomic(self, state: GovernorState) -> GovernorState:
        os.makedirs(os.path.dirname(self._path), exist_ok=True)
        stamped = replace(state, updated_at=_now_iso())
        payload = json.dumps(stamped.to_dict(), ensure_ascii=False, indent=2)
        dir_name = os.path.dirname(self._path)
        fd, tmp_path = tempfile.mkstemp(dir=dir_name, prefix=".state-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(payload)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, self._path)  # atômico no mesmo filesystem
        except BaseException:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise
        return stamped

    def write(self, state: GovernorState) -> GovernorState:
        """Escreve incrementando a versão. Retorna o estado persistido."""
        current = self.read()
        base_version = 0 if current.synthetic_fail_open else current.version
        return self._write_atomic(replace(state, version=base_version + 1))

    # -- transições idempotentes -------------------------------------------
    def transition(self, new_state: str, **fields) -> GovernorState:
        """
        Transição idempotente: se já está em new_state com os mesmos campos-chave,
        não reescreve (evita inflar a versão sem necessidade).
        """
        if new_state not in VALID_STATES:
            raise ValueError(f"invalid state: {new_state}")
        current = self.read()
        candidate = replace(
            current if not current.synthetic_fail_open else GovernorState(),
            state=new_state,
            synthetic_fail_open=False,
            **fields,
        )
        if (
            not current.synthetic_fail_open
            and current.state == candidate.state
            and current.reason == candidate.reason
            and current.expected_reset_at == candidate.expected_reset_at
        ):
            return current  # idempotente: nada mudou de fato
        return self.write(candidate)

    # atalhos legíveis
    def mark_running(self) -> GovernorState:
        return self.transition(RUNNING, reason=None, usage_percentage=None, remaining_usage=None)

    def request_pause(self, reason: str, usage_pct: Optional[float], reset_at: Optional[str]) -> GovernorState:
        return self.transition(
            PAUSE_REQUESTED,
            reason=reason,
            usage_percentage=usage_pct,
            remaining_usage=(None if usage_pct is None else max(0.0, 100.0 - usage_pct)),
            detected_at=_now_iso(),
            expected_reset_at=reset_at,
        )

    def mark_waiting_for_reset(self, usage_pct: Optional[float], reset_at: Optional[str]) -> GovernorState:
        return self.transition(
            PAUSED_WAITING_FOR_RESET,
            usage_percentage=usage_pct,
            remaining_usage=(None if usage_pct is None else max(0.0, 100.0 - usage_pct)),
            expected_reset_at=reset_at,
        )

    def mark_resuming(self) -> GovernorState:
        return self.transition(RESUMING)

    def mark_failed(self, reason: str) -> GovernorState:
        return self.transition(FAILED, reason=reason)
