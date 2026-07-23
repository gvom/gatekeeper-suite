"""
governor.inflight — contador de chamadas de ferramenta EM ANDAMENTO (GOVERNOR_PLAN.md §10).

Sem `tool_use_id` no PreToolUse (§2), não dá para parear Pre↔Post por id. Modelo adotado:
cada "start" cria um arquivo-marcador único; cada "end" remove o marcador MAIS ANTIGO
(FIFO, best-effort). O monitor conta markers não-expirados. TTL poda órfãos (tool sem
PostToolUse, crash, etc.), evitando inflar para sempre.

Race-safe: cada processo cria/remove SEU arquivo; não há contador compartilhado a corromper.
Tudo fail-open: qualquer erro é engolido (nunca quebra hook/daemon).
"""
from __future__ import annotations

import os
import time
from typing import Optional

from .config import GovernorConfig, load_config


class InflightTracker:
    def __init__(self, config: Optional[GovernorConfig] = None):
        self._config = config or load_config()
        self._dir = self._config.inflight_dir_path

    def _ensure_dir(self) -> None:
        os.makedirs(self._dir, exist_ok=True)

    def record_start(self) -> None:
        """Marca uma ferramenta que está prestes a executar. Best-effort, fail-open."""
        try:
            self._ensure_dir()
            # nome ordenável por tempo + único (pid + urandom) → sort lexical == FIFO temporal
            ts = time.time()
            name = f"{ts:018.6f}-{os.getpid()}-{os.urandom(4).hex()}"
            path = os.path.join(self._dir, name)
            with open(path, "w", encoding="utf-8") as f:
                f.write(str(ts))
        except Exception:
            pass

    def record_end(self) -> None:
        """Remove o marcador mais antigo (FIFO). Tolera corridas entre processos."""
        try:
            names = sorted(os.listdir(self._dir))
        except OSError:
            return
        for name in names:
            try:
                os.remove(os.path.join(self._dir, name))
                return  # removeu um; pronto
            except FileNotFoundError:
                continue  # outro processo já removeu este; tenta o próximo
            except OSError:
                continue

    def count(self) -> int:
        """Conta markers não-expirados; poda os expirados (> TTL). Fail-open → 0."""
        try:
            names = os.listdir(self._dir)
        except OSError:
            return 0
        ttl = self._config.inflight_ttl_ms / 1000.0
        now = time.time()
        alive = 0
        for name in names:
            path = os.path.join(self._dir, name)
            try:
                # timestamp está no prefixo do nome; fallback para mtime
                ts = float(name.split("-", 1)[0])
            except (ValueError, IndexError):
                try:
                    ts = os.path.getmtime(path)
                except OSError:
                    continue
            if (now - ts) > ttl:
                try:
                    os.remove(path)  # órfão → poda
                except OSError:
                    pass
                continue
            alive += 1
        return alive

    def clear(self) -> None:
        """Zera todos os markers (uso em teste / retomada). Fail-open."""
        try:
            for name in os.listdir(self._dir):
                try:
                    os.remove(os.path.join(self._dir, name))
                except OSError:
                    pass
        except OSError:
            pass
