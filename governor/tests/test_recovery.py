import os
import sys
import unittest

_HOOKS_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _HOOKS_DIR not in sys.path:
    sys.path.insert(0, _HOOKS_DIR)

import governor_barrier as barrier  # noqa: E402
from governor.recovery import SessionRecoveryManager, ST_WAITING, ST_ABANDONED, ST_RESUMED  # noqa: E402
from governor.state_store import GlobalPauseStateStore  # noqa: E402
from .base import GovernorTestCase  # noqa: E402


class TestRecovery(GovernorTestCase):
    def setUp(self):
        super().setUp()
        self.captured = []
        self.rec = SessionRecoveryManager(self.cfg, notifier=lambda c, m: self.captured.append(m))

    def _make_checkpoint(self, sid="sess-XYZ", tool="Edit"):
        barrier.write_checkpoint(self.cfg, {"session_id": sid, "cwd": os.getcwd()}, tool)

    def test_no_checkpoint(self):
        self.assertIsNone(self.rec.pending())
        self.assertIsNone(self.rec.check_and_notify(True))

    def test_waiting_not_pending(self):
        self._make_checkpoint()
        self.assertEqual(self.rec.read_checkpoint()["status"], ST_WAITING)
        self.assertIsNone(self.rec.pending())

    def test_resume_command(self):
        self._make_checkpoint(sid="sess-ABC")
        self.assertEqual(self.rec.resume_command(self.rec.read_checkpoint()), "claude --resume sess-ABC")

    def test_abandoned_pending_and_notify(self):
        self._make_checkpoint(sid="sess-XYZ")
        self.rec.mark_abandoned()
        self.assertIsNotNone(self.rec.pending())
        self.assertIsNone(self.rec.check_and_notify(False))  # sem reset
        self.assertEqual(len(self.captured), 0)
        msg = self.rec.check_and_notify(True)
        self.assertIn("claude --resume sess-XYZ", msg)
        self.assertEqual(len(self.captured), 1)
        self.assertIsNone(self.rec.pending())  # resolvido
        self.assertEqual(self.rec.read_checkpoint()["status"], ST_RESUMED)
        # idempotente
        self.assertIsNone(self.rec.check_and_notify(True))
        self.assertEqual(len(self.captured), 1)

    def test_default_notifier_writes_notice(self):
        rec = SessionRecoveryManager(self.cfg)  # notifier default
        self._make_checkpoint(sid="sess-NOTE")
        rec.mark_abandoned()
        rec.check_and_notify(True)
        notice = os.path.join(os.path.dirname(self.cfg.checkpoint_path), "recovery_notice.txt")
        self.assertTrue(os.path.exists(notice))
        with open(notice, encoding="utf-8") as f:
            self.assertIn("claude --resume sess-NOTE", f.read())

    def test_barrier_cap_marks_abandoned(self):
        os.environ["GOVERNOR_HOOK_WAIT_TIMEOUT_MS"] = "1000"
        cfg = self.reload_cfg()
        store = GlobalPauseStateStore(cfg)
        store.request_pause("usage_limit", 99.0, None)
        barrier.write_checkpoint(cfg, {"session_id": "sess-CAP", "cwd": os.getcwd()}, "Write")
        rec = SessionRecoveryManager(cfg, notifier=lambda c, m: None)
        tc = {"t": 0.0}
        barrier.run({"session_id": "sess-CAP", "cwd": os.getcwd(), "tool_name": "Write"},
                    env={}, store=store, config=cfg, recovery=rec,
                    sleep_fn=lambda _: tc.__setitem__("t", tc["t"] + 0.6),
                    clock=lambda: tc["t"])
        self.assertEqual(rec.read_checkpoint()["status"], ST_ABANDONED)

    def test_barrier_release_marks_resumed(self):
        os.environ["GOVERNOR_RESET_CHECK_INTERVAL_MS"] = "5"
        cfg = self.reload_cfg()
        store = GlobalPauseStateStore(cfg)
        store.request_pause("usage_limit", 99.0, None)
        barrier.write_checkpoint(cfg, {"session_id": "sess-REL", "cwd": os.getcwd()}, "Read")
        rec = SessionRecoveryManager(cfg)
        flip = {"n": 0}
        def s(_):
            flip["n"] += 1
            if flip["n"] == 2:
                store.mark_running()
        barrier.run({"session_id": "sess-REL", "cwd": os.getcwd(), "tool_name": "Read"},
                    env={}, store=store, config=cfg, recovery=rec, sleep_fn=s)
        self.assertEqual(rec.read_checkpoint()["status"], ST_RESUMED)


if __name__ == "__main__":
    unittest.main()
