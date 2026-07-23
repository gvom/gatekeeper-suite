"""
governor.burn_rate — taxa de consumo e previsão de esgotamento (GOVERNOR_PLAN.md §5).

- UsageBurnRateCalculator: janela móvel de amostras (ts_seg, utilization) → %/min.
- UsageLimitPredictor: minutos estimados até 100% dada a taxa atual.

Relógio injetável (`clock`) p/ testes determinísticos (§9). Default: time.monotonic.
Imune a reset de wall-clock; válido dentro da vida do daemon.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, List, Optional, Tuple

from .config import GovernorConfig, load_config

Sample = Tuple[float, float]  # (timestamp_segundos, utilization_pct)


class UsageBurnRateCalculator:
    def __init__(self, config: Optional[GovernorConfig] = None, clock: Callable[[], float] = time.monotonic):
        self._config = config or load_config()
        self._clock = clock
        self._samples: List[Sample] = []

    @property
    def window_seconds(self) -> float:
        return self._config.burn_rate_window_ms / 1000.0

    def add_sample(self, utilization: Optional[float], now: Optional[float] = None) -> None:
        """Registra uma amostra de utilization (ignora None) e poda a janela."""
        if utilization is None:
            return
        ts = now if now is not None else self._clock()
        self._samples.append((ts, float(utilization)))
        self._prune(ts)

    def _prune(self, now: float) -> None:
        cutoff = now - self.window_seconds
        self._samples = [(t, u) for (t, u) in self._samples if t >= cutoff]

    def sample_count(self) -> int:
        return len(self._samples)

    def has_enough_samples(self) -> bool:
        return len(self._samples) >= self._config.minimum_samples_for_prediction

    def burn_rate_per_min(self) -> Optional[float]:
        """
        %/min entre a amostra mais antiga e a mais recente na janela.
        None se amostras insuficientes ou intervalo de tempo desprezível.
        Pode ser <= 0 (uso estável ou caiu — ex.: após reset).
        """
        if not self.has_enough_samples():
            return None
        t_old, u_old = self._samples[0]
        t_new, u_new = self._samples[-1]
        dt_min = (t_new - t_old) / 60.0
        if dt_min <= 1e-9:
            return None
        return (u_new - u_old) / dt_min

    def latest_utilization(self) -> Optional[float]:
        return self._samples[-1][1] if self._samples else None

    def reset(self) -> None:
        self._samples.clear()


class UsageLimitPredictor:
    def __init__(self, config: Optional[GovernorConfig] = None):
        self._config = config or load_config()

    def minutes_to_100(self, current_utilization: float, burn_rate_per_min: Optional[float]) -> Optional[float]:
        """
        Minutos estimados até 100%.
        - None se taxa desconhecida (amostras insuficientes).
        - float('inf') se taxa <= 0 (não vai esgotar no ritmo atual).
        - >= 0 caso contrário.
        """
        if burn_rate_per_min is None:
            return None
        if current_utilization >= 100.0:
            return 0.0
        if burn_rate_per_min <= 0.0:
            return float("inf")
        remaining = 100.0 - current_utilization
        return remaining / burn_rate_per_min
