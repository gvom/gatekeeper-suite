"""
governor.reset_detector — detecção de reset real da janela (GOVERNOR_PLAN.md §5).

Reset real = `resets_at` avançou para o futuro (sinal forte/definitivo)
             E/OU utilization caiu significativamente para um patamar baixo.
NÃO retomar por queda momentânea (ruído). Stateful: observa janelas em sequência.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from .config import GovernorConfig, load_config
from .metrics import UsageWindow


@dataclass(frozen=True)
class ResetEvent:
    detected: bool
    reason: str  # "resets_at_advanced" | "utilization_dropped" | "none"


class ResetDetector:
    def __init__(self, config: Optional[GovernorConfig] = None):
        self._config = config or load_config()
        self._prev: Optional[UsageWindow] = None

    @property
    def previous(self) -> Optional[UsageWindow]:
        return self._prev

    def is_resource_available(self, window: Optional[UsageWindow]) -> bool:
        """True se a capacidade disponível atinge o mínimo p/ retomar (§7)."""
        if window is None or window.utilization is None:
            return True  # sem dado → não travar (fail-open)
        available = 100.0 - window.utilization
        return available >= self._config.minimum_available_percentage_to_resume

    def observe(self, window: Optional[UsageWindow]) -> ResetEvent:
        """Compara com a observação anterior e decide se houve reset."""
        prev = self._prev
        # Atualiza o baseline sempre ao fim.
        try:
            if window is None:
                return ResetEvent(False, "none")
            if prev is None:
                return ResetEvent(False, "none")

            # Sinal forte: janela de reset avançou para um novo horário futuro.
            if (
                window.resets_at is not None
                and prev.resets_at is not None
                and isinstance(window.resets_at, datetime)
                and isinstance(prev.resets_at, datetime)
                and window.resets_at > prev.resets_at
            ):
                return ResetEvent(True, "resets_at_advanced")

            # Sinal secundário: utilization caiu bastante E chegou a patamar baixo.
            if window.utilization is not None and prev.utilization is not None:
                drop = prev.utilization - window.utilization
                low_enough = window.utilization <= (
                    100.0 - self._config.minimum_available_percentage_to_resume
                )
                if drop >= self._config.reset_min_utilization_drop and low_enough:
                    return ResetEvent(True, "utilization_dropped")

            return ResetEvent(False, "none")
        finally:
            self._prev = window
