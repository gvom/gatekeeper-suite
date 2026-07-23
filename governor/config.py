"""
governor.config — parâmetros centralizados (GOVERNOR_PLAN.md §7).

Todos os valores vêm de env `GOVERNOR_*` com defaults conservadores.
Nenhum valor mágico deve ser espalhado pelos outros módulos: importar daqui.
Base de caminhos respeita CLAUDE_CONFIG_DIR (senão ~/.claude), igual ao Claude Code.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


def config_base_dir() -> str:
    """Diretório base do Claude Code (CLAUDE_CONFIG_DIR ou ~/.claude)."""
    override = os.getenv("CLAUDE_CONFIG_DIR")
    if override:
        return os.path.abspath(os.path.expanduser(override))
    return os.path.abspath(os.path.expanduser(os.path.join("~", ".claude")))


def _governor_dir() -> str:
    return os.path.join(config_base_dir(), "governor")


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(float(raw))
    except (ValueError, TypeError):
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return float(raw)
    except (ValueError, TypeError):
        return default


def _env_path(name: str, default_filename: str) -> str:
    raw = os.getenv(name)
    if raw and str(raw).strip():
        return os.path.abspath(os.path.expanduser(raw))
    return os.path.join(_governor_dir(), default_filename)


@dataclass(frozen=True)
class GovernorConfig:
    # --- monitor / decisão ---
    monitoring_interval_ms: int
    safety_margin_ms: int
    maximum_usage_percentage: float
    minimum_available_percentage_to_resume: float
    burn_rate_window_ms: int
    minimum_samples_for_prediction: int
    maximum_estimated_usage_per_in_flight_request: float
    # --- barreira ---
    hook_wait_timeout_ms: int
    reset_check_interval_ms: int
    # --- detecção de reset ---
    reset_min_utilization_drop: float
    # --- métricas ---
    metrics_cache_ttl_ms: int
    metrics_http_timeout_ms: int
    # --- caminhos ---
    state_file_path: str
    checkpoint_path: str
    lock_file_path: str
    log_file_path: str
    # --- misc ---
    state_change_notification_mode: str


def load_config() -> GovernorConfig:
    """Lê a configuração do ambiente. Chamável a cada uso (barato)."""
    return GovernorConfig(
        monitoring_interval_ms=_env_int("GOVERNOR_MONITORING_INTERVAL_MS", 30_000),
        safety_margin_ms=_env_int("GOVERNOR_SAFETY_MARGIN_MS", 120_000),
        maximum_usage_percentage=_env_float("GOVERNOR_MAXIMUM_USAGE_PERCENTAGE", 95.0),
        minimum_available_percentage_to_resume=_env_float(
            "GOVERNOR_MINIMUM_AVAILABLE_PERCENTAGE_TO_RESUME", 50.0
        ),
        burn_rate_window_ms=_env_int("GOVERNOR_BURN_RATE_WINDOW_MS", 600_000),
        minimum_samples_for_prediction=_env_int(
            "GOVERNOR_MINIMUM_SAMPLES_FOR_PREDICTION", 3
        ),
        maximum_estimated_usage_per_in_flight_request=_env_float(
            # % de janela consumida por chamada em andamento — estimativa conservadora.
            "GOVERNOR_MAX_ESTIMATED_USAGE_PER_IN_FLIGHT_REQUEST", 1.0
        ),
        # teto seguro < timeout do hook (21600s → 21_600_000ms). Default 21_000_000ms.
        hook_wait_timeout_ms=_env_int("GOVERNOR_HOOK_WAIT_TIMEOUT_MS", 21_000_000),
        reset_check_interval_ms=_env_int("GOVERNOR_RESET_CHECK_INTERVAL_MS", 15_000),
        # queda mínima de utilization (pontos %) p/ considerar reset por queda de uso
        reset_min_utilization_drop=_env_float("GOVERNOR_RESET_MIN_UTILIZATION_DROP", 20.0),
        metrics_cache_ttl_ms=_env_int("GOVERNOR_METRICS_CACHE_TTL_MS", 15_000),
        metrics_http_timeout_ms=_env_int("GOVERNOR_METRICS_HTTP_TIMEOUT_MS", 12_000),
        state_file_path=_env_path("GOVERNOR_STATE_FILE_PATH", "state.json"),
        checkpoint_path=_env_path("GOVERNOR_CHECKPOINT_PATH", "checkpoint.json"),
        lock_file_path=_env_path("GOVERNOR_LOCK_FILE_PATH", "monitor.lock"),
        log_file_path=_env_path("GOVERNOR_LOG_FILE_PATH", "governor.log"),
        state_change_notification_mode=os.getenv(
            "GOVERNOR_STATE_CHANGE_NOTIFICATION_MODE", "polling"
        ),
    )


def ensure_governor_dir() -> str:
    """Garante que o diretório do governor exista. Retorna o caminho."""
    d = _governor_dir()
    os.makedirs(d, exist_ok=True)
    return d
