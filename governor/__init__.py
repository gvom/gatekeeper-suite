"""
governor — monitor de limite de uso do Claude Code com pausa/retomada automática.
Ver GOVERNOR_PLAN.md. Fail-open é regra de ouro em todo o pacote.
"""
__all__ = [
    "config",
    "metrics",
    "state_store",
    "burn_rate",
    "decision",
    "reset_detector",
    "monitor",
    "recovery",
    "remote",
    "inflight",
]
