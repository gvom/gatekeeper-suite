import os
import unittest
from datetime import timedelta

from governor.remote import RemoteInteractionBridge, combined_notifier
from governor.monitor import Monitor
from governor.state_store import GlobalPauseStateStore
from .base import GovernorTestCase
from .fakes import FakeProvider, TelegramRecorder, base_dt

CHAT = "555"


class TestRemoteBridge(GovernorTestCase):
    def test_disabled_by_env(self):
        b = RemoteInteractionBridge(self.cfg)
        self.assertFalse(b.enabled)
        rec = TelegramRecorder()
        b._transport = rec
        self.assertFalse(b.notify("x"))
        self.assertEqual(len(rec.calls), 0)

    def test_enabled_notify(self):
        rec = TelegramRecorder()
        b = RemoteInteractionBridge(self.cfg, enabled=True, transport=rec, chat_id=CHAT, timeout=1)
        self.assertTrue(b.enabled)
        self.assertTrue(b.notify("aviso"))
        self.assertEqual(rec.calls[-1][0], "sendMessage")
        self.assertEqual(rec.calls[-1][1]["chat_id"], CHAT)

    def test_notify_transport_error_fail_open(self):
        def boom(*a):
            raise RuntimeError("net down")
        b = RemoteInteractionBridge(self.cfg, enabled=True, transport=boom, chat_id=CHAT)
        self.assertFalse(b.notify("x"))

    def test_ask_authenticated(self):
        rec = TelegramRecorder(from_chat=CHAT)
        b = RemoteInteractionBridge(self.cfg, enabled=True, transport=rec, chat_id=CHAT, timeout=2)
        self.assertEqual(b.ask("Retomar?", [("Sim", "yes"), ("Não", "no")]), "yes")

    def test_ask_wrong_chat(self):
        rec = TelegramRecorder(from_chat="999")
        b = RemoteInteractionBridge(self.cfg, enabled=True, transport=rec, chat_id=CHAT, timeout=1)
        self.assertIsNone(b.ask("Q", [("A", "a")]))

    def test_ask_wrong_nonce(self):
        rec = TelegramRecorder(break_nonce=True)
        b = RemoteInteractionBridge(self.cfg, enabled=True, transport=rec, chat_id=CHAT, timeout=1)
        self.assertIsNone(b.ask("Q", [("A", "a")]))

    def test_ask_disabled(self):
        self.assertIsNone(RemoteInteractionBridge(self.cfg, enabled=False).ask("Q", [("A", "a")]))

    def test_combined_notifier(self):
        rec = TelegramRecorder()
        b = RemoteInteractionBridge(self.cfg, enabled=True, transport=rec, chat_id=CHAT)
        combined_notifier(b)(self.cfg, "msg-recovery")
        notice = os.path.join(os.path.dirname(self.cfg.checkpoint_path), "recovery_notice.txt")
        self.assertTrue(os.path.exists(notice))
        self.assertTrue(any(m == "sendMessage" and "msg-recovery" in p.get("text", "")
                            for (m, p) in rec.calls))


class TestMonitorRemoteEvents(GovernorTestCase):
    def test_pause_and_resume_notify(self):
        store = GlobalPauseStateStore(self.cfg)
        rec = TelegramRecorder()
        bridge = RemoteInteractionBridge(self.cfg, enabled=True, transport=rec, chat_id=CHAT, timeout=1)
        fp = FakeProvider()
        m = Monitor(config=self.cfg, provider=fp, store=store, remote=bridge)
        base = base_dt()
        fp.set(96.0, base); m.run_once()
        self.assertTrue(any("Pausando" in t for t in rec.sent_texts()))
        fp.set(20.0, base); m.run_once()
        self.assertTrue(any("retomada" in t for t in rec.sent_texts()))

    def test_waiting_heartbeat_throttled(self):
        os.environ["GOVERNOR_HEARTBEAT_INTERVAL_MS"] = "1000"  # 1s
        cfg = self.reload_cfg()
        store = GlobalPauseStateStore(cfg)
        rec = TelegramRecorder()
        bridge = RemoteInteractionBridge(cfg, enabled=True, transport=rec, chat_id=CHAT, timeout=1)
        fp = FakeProvider()
        t = {"v": 100.0}
        m = Monitor(config=cfg, provider=fp, store=store, remote=bridge, clock=lambda: t["v"])
        base = base_dt()

        def hb():
            return sum(1 for x in rec.sent_texts() if "ainda pausado" in x)

        fp.set(96.0, base); m.run_once()            # pausa; heartbeat marcado em t=100
        t["v"] = 100.5; fp.set(96.0, base); m.run_once()   # +0.5s < 1s → sem heartbeat
        self.assertEqual(hb(), 0)
        t["v"] = 101.2; fp.set(96.0, base); m.run_once()   # +1.2s ≥ 1s → heartbeat
        self.assertEqual(hb(), 1)
        t["v"] = 101.3; fp.set(96.0, base); m.run_once()   # logo após → throttled
        self.assertEqual(hb(), 1)
        t["v"] = 102.5; fp.set(96.0, base); m.run_once()   # +interval → 2º heartbeat
        self.assertEqual(hb(), 2)


if __name__ == "__main__":
    unittest.main()
