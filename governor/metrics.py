"""
governor.metrics — leitura do uso da conta via endpoint OAuth interno (GOVERNOR_PLAN.md §3).

Método replicado de jens-duttke/usage-monitor-for-claude (MIT).
Usa apenas a stdlib (urllib) para ser à prova de falha de dependência no caminho crítico.

REGRAS DE OURO:
- NUNCA logar/retornar o accessToken.
- Endpoint interno/não-oficial: qualquer falha vira MetricsUnavailable → o chamador faz fail-open.
- Cache curto (config.metrics_cache_ttl_ms) p/ não martelar a API.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional

from .config import GovernorConfig, config_base_dir, load_config

USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
PROFILE_URL = "https://api.anthropic.com/api/oauth/profile"
ANTHROPIC_BETA = "oauth-2025-04-20"
DEFAULT_USER_AGENT = "claude-code/2.1.204"


class MetricsUnavailable(Exception):
    """Métrica não pôde ser obtida. Chamador DEVE tratar como fail-open."""


@dataclass(frozen=True)
class UsageWindow:
    name: str
    utilization: Optional[float]  # % consumido 0–100 (pode ser None)
    resets_at: Optional[datetime]  # tz-aware ou None


@dataclass
class UsageSnapshot:
    windows: Dict[str, UsageWindow]
    fetched_at_monotonic: float
    fetched_at_wall: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def window(self, name: str) -> Optional[UsageWindow]:
        return self.windows.get(name)

    @property
    def five_hour(self) -> Optional[UsageWindow]:
        return self.windows.get("five_hour")

    @property
    def seven_day(self) -> Optional[UsageWindow]:
        return self.windows.get("seven_day")

    def max_utilization(self) -> Optional[float]:
        vals = [w.utilization for w in self.windows.values() if w.utilization is not None]
        return max(vals) if vals else None


def _credentials_path() -> str:
    return os.path.join(config_base_dir(), ".credentials.json")


def read_access_token() -> str:
    """Lê o accessToken do credentials.json. Levanta MetricsUnavailable se ausente."""
    path = _credentials_path()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as e:
        raise MetricsUnavailable(f"credentials unreadable: {type(e).__name__}") from e
    tok = ((data.get("claudeAiOauth") or {}).get("accessToken")) if isinstance(data, dict) else None
    if not tok:
        raise MetricsUnavailable("accessToken missing")
    return tok


def _parse_resets_at(value) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        # ISO 8601 com offset; normaliza 'Z'
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_windows(payload: dict) -> Dict[str, UsageWindow]:
    """Parse genérico: qualquer dict de topo com 'utilization' + 'resets_at' vira janela."""
    windows: Dict[str, UsageWindow] = {}
    if not isinstance(payload, dict):
        return windows
    for key, val in payload.items():
        if not isinstance(val, dict):
            continue
        if "utilization" not in val or "resets_at" not in val:
            continue
        util = val.get("utilization")
        try:
            util = float(util) if util is not None else None
        except (ValueError, TypeError):
            util = None
        windows[key] = UsageWindow(
            name=key,
            utilization=util,
            resets_at=_parse_resets_at(val.get("resets_at")),
        )
    return windows


def _claude_binary() -> Optional[str]:
    found = shutil.which("claude")
    if found:
        return found
    appdata = os.getenv("APPDATA")
    if appdata:
        for name in ("claude.cmd", "claude.exe"):
            cand = os.path.join(appdata, "npm", name)
            if os.path.exists(cand):
                return cand
    return None


class UsageMetricsProvider:
    """Provedor com cache curto. Uma instância por daemon; thread-única esperada."""

    def __init__(self, config: Optional[GovernorConfig] = None, user_agent: Optional[str] = None):
        self._config = config or load_config()
        self._user_agent = user_agent or os.getenv("GOVERNOR_USER_AGENT", DEFAULT_USER_AGENT)
        self._cache: Optional[UsageSnapshot] = None

    # -- HTTP interno ---------------------------------------------------------
    def _do_request(self, token: str) -> dict:
        req = urllib.request.Request(
            USAGE_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "User-Agent": self._user_agent,
                "anthropic-beta": ANTHROPIC_BETA,
            },
        )
        timeout = self._config.metrics_http_timeout_ms / 1000.0
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
        return json.loads(body)

    def _refresh_token(self) -> None:
        """No 401: tenta renovar o token rodando `claude update`. Best-effort, silencioso."""
        binary = _claude_binary()
        if not binary:
            raise MetricsUnavailable("claude binary not found for token refresh")
        try:
            subprocess.run(
                [binary, "update"],
                capture_output=True,
                timeout=120,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as e:
            raise MetricsUnavailable(f"token refresh failed: {type(e).__name__}") from e

    # -- API pública ----------------------------------------------------------
    def fetch_usage(self, force: bool = False) -> UsageSnapshot:
        """
        Retorna um UsageSnapshot (cache curto). Levanta MetricsUnavailable em qualquer falha.
        Trata: 401 (refresh + 1 retry), 429 (respeita Retry-After até um teto), 5xx/rede (falha).
        """
        now = time.monotonic()
        if not force and self._cache is not None:
            age_ms = (now - self._cache.fetched_at_monotonic) * 1000.0
            if age_ms < self._config.metrics_cache_ttl_ms:
                return self._cache

        token = read_access_token()
        payload = None
        refreshed = False
        for attempt in range(2):
            try:
                payload = self._do_request(token)
                break
            except urllib.error.HTTPError as e:
                if e.code == 401 and not refreshed:
                    self._refresh_token()
                    refreshed = True
                    token = read_access_token()
                    continue
                if e.code == 429:
                    retry_after = e.headers.get("Retry-After") if e.headers else None
                    raise MetricsUnavailable(f"rate limited (429), retry-after={retry_after}") from e
                raise MetricsUnavailable(f"http {e.code}") from e
            except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
                raise MetricsUnavailable(f"request failed: {type(e).__name__}") from e

        if payload is None:
            raise MetricsUnavailable("no payload after retries")

        windows = _parse_windows(payload)
        if not windows:
            raise MetricsUnavailable("no usage windows parsed")

        snapshot = UsageSnapshot(windows=windows, fetched_at_monotonic=time.monotonic())
        self._cache = snapshot
        return snapshot
