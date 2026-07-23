"""Fakes reutilizáveis: provedor de métricas e transporte Telegram."""
import time
from datetime import datetime, timezone

from governor.metrics import MetricsUnavailable, UsageSnapshot, UsageWindow


class FakeProvider:
    """Provedor de métricas controlável (sem rede)."""

    def __init__(self):
        self.snap = None

    def set(self, util, reset_at, window="five_hour"):
        self.snap = UsageSnapshot(
            windows={window: UsageWindow(window, util, reset_at)},
            fetched_at_monotonic=time.monotonic(),
        )

    def set_snapshot(self, snapshot):
        self.snap = snapshot

    def fail(self):
        self.snap = None

    def fetch_usage(self, force=False):
        if self.snap is None:
            raise MetricsUnavailable("fake: no snapshot")
        return self.snap


class TelegramRecorder:
    """Fake do _tg_api do gatekeeper. Registra chamadas e responde `ask`."""

    def __init__(self, from_chat="555", break_nonce=False, answer=True):
        self.calls = []
        self.from_chat = from_chat
        self.break_nonce = break_nonce
        self.answer = answer
        self._last_cb = None
        self._served = False

    def sent_texts(self):
        return [p.get("text", "") for (m, p) in self.calls if m == "sendMessage"]

    def __call__(self, method, params, timeout):
        self.calls.append((method, params))
        if method == "sendMessage":
            kb = params.get("reply_markup", {}).get("inline_keyboard")
            if kb:
                self._last_cb = kb[0][0]["callback_data"]
            return {"ok": True}
        if method == "answerCallbackQuery":
            return {"ok": True}
        if method == "getUpdates":
            if not self.answer or self._last_cb is None or self._served:
                return {"ok": True, "result": []}
            self._served = True
            data = self._last_cb
            if self.break_nonce:
                data = data.split(":", 1)[0] + ":deadbeef"
            return {
                "ok": True,
                "result": [
                    {
                        "update_id": 10,
                        "callback_query": {
                            "id": "c1",
                            "from": {"id": self.from_chat},
                            "data": data,
                        },
                    }
                ],
            }
        return {"ok": True}


def base_dt():
    return datetime(2026, 7, 23, 2, 0, 0, tzinfo=timezone.utc)
