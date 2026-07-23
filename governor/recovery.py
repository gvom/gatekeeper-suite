"""
governor.recovery — fallback ASSISTIDO (GOVERNOR_PLAN.md §5, decisão §1).

Quando a barreira NÃO consegue segurar a mesma chamada até o reset (hook morto pelo
Claude Code no teto de timeout, ou sessão reiniciada), o contexto da chamada exata se
perde. Este módulo detecta esse caso via checkpoint, aguarda o reset e NOTIFICA o
usuário com o comando `claude --resume <session_id>` pronto.

NÃO mata nem respawna processo (auto-respawn rejeitado — §1). Só grava/lê checkpoint
e emite a notificação. Notificação local por padrão; o canal remoto entra na Fase 6.
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from typing import Callable, Optional

from .config import GovernorConfig, load_config

# status do checkpoint
ST_WAITING = "waiting"      # barreira segurando a chamada
ST_ABANDONED = "abandoned"  # barreira desistiu (teto/hook-morto) → precisa de --resume
ST_RESUMED = "resumed"      # barreira liberou a mesma chamada com sucesso (sem recovery)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_write_json(path: str, payload: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".rec-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _default_notifier(config: GovernorConfig, message: str) -> None:
    """Notificação local: log + arquivo de aviso legível. Fail-open (nunca levanta)."""
    try:
        os.makedirs(os.path.dirname(config.log_file_path), exist_ok=True)
        with open(config.log_file_path, "a", encoding="utf-8") as f:
            f.write(f"{_now_iso()} [recovery] {message}\n")
    except Exception:
        pass
    try:
        notice = os.path.join(os.path.dirname(config.checkpoint_path), "recovery_notice.txt")
        with open(notice, "w", encoding="utf-8") as f:
            f.write(message + "\n")
    except Exception:
        pass


class SessionRecoveryManager:
    def __init__(
        self,
        config: Optional[GovernorConfig] = None,
        notifier: Optional[Callable[[GovernorConfig, str], None]] = None,
    ):
        self._config = config or load_config()
        self._notifier = notifier or _default_notifier

    @property
    def checkpoint_path(self) -> str:
        return self._config.checkpoint_path

    # -- leitura/escrita do checkpoint -------------------------------------
    def read_checkpoint(self) -> Optional[dict]:
        try:
            with open(self.checkpoint_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else None
        except (OSError, ValueError):
            return None

    def _update_status(self, status: str) -> Optional[dict]:
        ck = self.read_checkpoint()
        if ck is None:
            return None
        ck["status"] = status
        ck["statusUpdatedAt"] = _now_iso()
        try:
            _atomic_write_json(self.checkpoint_path, ck)
        except Exception:
            return None
        return ck

    def mark_abandoned(self) -> Optional[dict]:
        """Chamado pela barreira ao atingir o teto de espera (hook será morto/desistiu)."""
        return self._update_status(ST_ABANDONED)

    def mark_resumed(self) -> Optional[dict]:
        """Chamado pela barreira quando libera a MESMA chamada com sucesso (sem recovery)."""
        return self._update_status(ST_RESUMED)

    # -- detecção + notificação --------------------------------------------
    def pending(self) -> Optional[dict]:
        """Checkpoint que representa uma pausa NÃO resolvida (precisa de --resume)."""
        ck = self.read_checkpoint()
        if ck is None:
            return None
        return ck if ck.get("status") == ST_ABANDONED else None

    @staticmethod
    def resume_command(checkpoint: dict) -> Optional[str]:
        sid = checkpoint.get("sessionId")
        if not sid:
            return None
        return f"claude --resume {sid}"

    def build_notice(self, checkpoint: dict) -> str:
        cmd = self.resume_command(checkpoint) or "claude --resume <session-id-indisponível>"
        repo = checkpoint.get("repository") or {}
        branch = repo.get("branch")
        return (
            "Governor: limite resetado, mas a chamada pausada não pôde ser retomada "
            "automaticamente (hook encerrado antes do reset). Retome o contexto com:\n"
            f"  {cmd}\n"
            f"(branch: {branch}). Repassar flags dinâmicas se usadas: "
            "--mcp-config / --settings / --plugin-dir. O --resume recupera o histórico, "
            "não a chamada de ferramenta exata."
        )

    def check_and_notify(self, reset_happened: bool) -> Optional[str]:
        """
        Se há checkpoint abandonado E o reset ocorreu, notifica com o comando de resume
        e marca o checkpoint como resolvido. Retorna a mensagem enviada (ou None).
        """
        if not reset_happened:
            return None
        ck = self.pending()
        if ck is None:
            return None
        message = self.build_notice(ck)
        try:
            self._notifier(self._config, message)
        except Exception:
            pass  # fail-open: falha de notificação nunca quebra o fluxo
        self._update_status(ST_RESUMED)  # resolvido → não notificar de novo
        return message
