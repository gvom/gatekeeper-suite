"""
governor.decision — motor de decisão de pausa (GOVERNOR_PLAN.md §5).

Regra (§5): pausar = utilization >= maxUsagePct
                     OU tempoAte100 <= (margem de segurança).
Considera consumo em andamento (§10): utilization efetiva soma a estimativa
das chamadas in-flight. Com amostras insuficientes, desativa a regra preditiva
(estratégia conservadora: só o teto de % vale — §7).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .config import GovernorConfig, load_config


@dataclass(frozen=True)
class PauseDecision:
    should_pause: bool
    reason: str  # "usage_threshold" | "predictive" | "ok"
    effective_utilization: float
    minutes_to_100: Optional[float]


class PauseDecisionEngine:
    def __init__(self, config: Optional[GovernorConfig] = None):
        self._config = config or load_config()

    def _effective_utilization(self, current_utilization: float, in_flight_requests: int) -> float:
        extra = max(0, in_flight_requests) * self._config.maximum_estimated_usage_per_in_flight_request
        return min(100.0, current_utilization + extra)

    def decide(
        self,
        current_utilization: float,
        minutes_to_100: Optional[float],
        in_flight_requests: int = 0,
    ) -> PauseDecision:
        eff = self._effective_utilization(current_utilization, in_flight_requests)

        # Regra 1 — teto de % (sempre ativa).
        if eff >= self._config.maximum_usage_percentage:
            return PauseDecision(True, "usage_threshold", eff, minutes_to_100)

        # Regra 2 — preditiva (só se há previsão; None = amostras insuficientes → pular).
        if minutes_to_100 is not None:
            margin_min = self._config.safety_margin_ms / 60_000.0
            if minutes_to_100 <= margin_min:
                return PauseDecision(True, "predictive", eff, minutes_to_100)

        return PauseDecision(False, "ok", eff, minutes_to_100)
