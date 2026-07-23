"""
governor.remote — ponte de interação remota (GOVERNOR_PLAN.md §5, subseção remota).

Reusa o MESMO canal Telegram do gatekeeper (transporte `_tg_api`, config `REMOTE_*`),
sem reimplementar o cliente nem duplicar config. Import lazy do gatekeeper só quando
o remoto está habilitado, para não pagar custo/side-effects à toa.

Expõe:
- notify(text)            → envio unidirecional (sendMessage) p/ avisos.
- ask(prompt, options)    → pergunta autenticada (nonce one-shot, valida chat_id,
                            timeout, fail-safe → None). Mesma mecânica do remote_ask.

REGRAS: só age se REMOTE_ENABLED; caso contrário no-op local. NUNCA falha o fluxo
por erro remoto (fail-open). NUNCA loga/envia token ou conteúdo sensível.
"""
from __future__ import annotations

import os
import secrets
import time
from typing import Callable, List, Optional, Sequence, Tuple

from .config import GovernorConfig, load_config

# Mesmos nomes de env do gatekeeper (fonte única de config do canal).
_ENV_ENABLED = "GATEKEEPER_REMOTE"
_ENV_CHAT_ID = "GATEKEEPER_REMOTE_CHAT_ID"
_ENV_TIMEOUT = "GATEKEEPER_REMOTE_TIMEOUT"

Transport = Callable[[str, dict, int], dict]  # (method, params, timeout) -> dict


def _remote_enabled_env() -> bool:
    return os.getenv(_ENV_ENABLED, "").lower() == "telegram"


def _lazy_gatekeeper_transport() -> Optional[Transport]:
    """Importa _tg_api do gatekeeper sob demanda. None se indisponível (fail-open)."""
    try:
        import gatekeeper  # hook no mesmo diretório; sys.path já ajustado pelo chamador

        return gatekeeper._tg_api  # type: ignore[attr-defined]
    except Exception:
        return None


class RemoteInteractionBridge:
    def __init__(
        self,
        config: Optional[GovernorConfig] = None,
        *,
        enabled: Optional[bool] = None,
        transport: Optional[Transport] = None,
        chat_id: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        self._config = config or load_config()
        self._enabled = _remote_enabled_env() if enabled is None else enabled
        self._transport = transport  # None → resolve lazy no primeiro uso
        self._chat_id = chat_id if chat_id is not None else os.getenv(_ENV_CHAT_ID, "")
        try:
            self._timeout = timeout if timeout is not None else int(os.getenv(_ENV_TIMEOUT, "60"))
        except (TypeError, ValueError):
            self._timeout = 60

    @property
    def enabled(self) -> bool:
        return bool(self._enabled) and bool(self._chat_id)

    def _get_transport(self) -> Optional[Transport]:
        if self._transport is None:
            self._transport = _lazy_gatekeeper_transport()
        return self._transport

    # -- envio unidirecional -----------------------------------------------
    def notify(self, text: str) -> bool:
        """Envia um aviso. Retorna True se enviado. No-op/False se desabilitado ou falha."""
        if not self.enabled:
            return False
        transport = self._get_transport()
        if transport is None:
            return False
        try:
            resp = transport("sendMessage", {"chat_id": self._chat_id, "text": text}, 15)
            return bool(resp.get("ok"))
        except Exception:
            return False  # fail-open: erro remoto nunca quebra o fluxo

    # -- pergunta autenticada ----------------------------------------------
    def ask(self, prompt: str, options: Sequence[Tuple[str, str]]) -> Optional[str]:
        """
        Pergunta com resposta remota autenticada. `options` = [(label, value), ...].
        Retorna o `value` escolhido, ou None (desabilitado / timeout / erro / chat inválido).
        Nonce one-shot anti-replay; só aceita resposta do REMOTE_CHAT_ID.
        """
        if not self.enabled or not options:
            return None
        transport = self._get_transport()
        if transport is None:
            return None

        nonce = secrets.token_hex(4)
        keyboard = {
            "inline_keyboard": [
                [{"text": label, "callback_data": f"{value}:{nonce}"}]
                for (label, value) in options
            ]
        }
        offset = 0
        try:
            upd = transport("getUpdates", {"timeout": 0, "allowed_updates": ["callback_query"]}, 10)
            if upd.get("ok") and upd.get("result"):
                offset = upd["result"][-1]["update_id"] + 1
            sent = transport(
                "sendMessage",
                {"chat_id": self._chat_id, "text": prompt, "reply_markup": keyboard},
                15,
            )
            if not sent.get("ok"):
                return None
        except Exception:
            return None

        deadline = time.time() + self._timeout
        while time.time() < deadline:
            wait = int(min(25, max(1, deadline - time.time())))
            try:
                upd = transport(
                    "getUpdates",
                    {"offset": offset, "timeout": wait, "allowed_updates": ["callback_query"]},
                    wait + 10,
                )
            except Exception:
                return None
            if not upd.get("ok"):
                continue
            for u in upd.get("result", []):
                offset = max(offset, u.get("update_id", 0) + 1)
                cq = u.get("callback_query")
                if not isinstance(cq, dict):
                    continue
                frm = str(cq.get("from", {}).get("id", ""))
                data = str(cq.get("data", ""))
                if frm != str(self._chat_id):
                    continue  # chat não autorizado → ignora
                if not data.endswith(f":{nonce}"):
                    continue  # nonce não confere → possível replay, ignora
                try:
                    transport("answerCallbackQuery", {"callback_query_id": cq.get("id"), "text": "OK"}, 10)
                except Exception:
                    pass
                return data.split(":", 1)[0]
        return None


def combined_notifier(bridge: RemoteInteractionBridge) -> Callable[[GovernorConfig, str], None]:
    """
    Notificador p/ o SessionRecoveryManager: sempre local (log + arquivo) e,
    se o remoto estiver habilitado, também envia via Telegram. Fail-open.
    """
    def _notify(config: GovernorConfig, message: str) -> None:
        try:
            from .recovery import _default_notifier

            _default_notifier(config, message)
        except Exception:
            pass
        try:
            bridge.notify(message)
        except Exception:
            pass

    return _notify
