import json
import os
import sys
import unittest

# barreira é hook no diretório pai do pacote
_HOOKS_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _HOOKS_DIR not in sys.path:
    sys.path.insert(0, _HOOKS_DIR)

import governor_barrier as barrier  # noqa: E402
from governor.state_store import GlobalPauseStateStore  # noqa: E402
from .base import GovernorTestCase  # noqa: E402


class TestBarrier(GovernorTestCase):
    def setUp(self):
        super().setUp()
        os.environ["GOVERNOR_RESET_CHECK_INTERVAL_MS"] = "10"
        self.cfg = self.reload_cfg()
        self.store = GlobalPauseStateStore(self.cfg)
        self.data = {"session_id": "s1", "transcript_path": "/t.jsonl",
                     "cwd": os.getcwd(), "tool_name": "Edit"}

    def _no_sleep_counter(self):
        c = {"n": 0}
        def s(_):
            c["n"] += 1
        return c, s

    def test_anti_recursion(self):
        self.store.request_pause("usage_limit", 99.0, None)
        c, s = self._no_sleep_counter()
        rc = barrier.run(self.data, env={"GATEKEEPER_INSIDE": "1"},
                         store=self.store, config=self.cfg, sleep_fn=s)
        self.assertEqual(rc, 0)
        self.assertEqual(c["n"], 0)

    def test_running_immediate_release(self):
        self.store.mark_running()
        c, s = self._no_sleep_counter()
        rc = barrier.run(self.data, env={}, store=self.store, config=self.cfg, sleep_fn=s)
        self.assertEqual(rc, 0)
        self.assertEqual(c["n"], 0)

    def test_paused_blocks_then_releases(self):
        self.store.request_pause("usage_limit", 99.0, "R")
        flip = {"n": 0}
        def s(_):
            flip["n"] += 1
            if flip["n"] == 3:
                self.store.mark_running()  # monitor detecta reset
        rc = barrier.run(self.data, env={}, store=self.store, config=self.cfg, sleep_fn=s)
        self.assertEqual(rc, 0)
        self.assertEqual(flip["n"], 3)
        self.assertTrue(self.store.read().allows_execution())

    def test_multiple_barriers_same_session(self):
        # dois "subagentes" (mesma sessão) bloqueiam e liberam juntos
        self.store.request_pause("usage_limit", 99.0, "R")
        for tool in ("Read", "Bash"):
            flip = {"n": 0}
            def s(_):
                flip["n"] += 1
                if flip["n"] == 2:
                    self.store.mark_running()
            data = dict(self.data, tool_name=tool)
            self.assertEqual(barrier.run(data, env={}, store=self.store,
                                         config=self.cfg, sleep_fn=s), 0)
            self.store.request_pause("usage_limit", 99.0, "R")  # re-pausa p/ o próximo

    def test_checkpoint_written(self):
        self.store.request_pause("usage_limit", 99.0, "R")
        flip = {"n": 0}
        def s(_):
            flip["n"] += 1
            if flip["n"] == 1:
                self.store.mark_running()
        barrier.run(self.data, env={}, store=self.store, config=self.cfg, sleep_fn=s)
        with open(self.cfg.checkpoint_path, encoding="utf-8") as f:
            ck = json.load(f)
        self.assertEqual(ck["sessionId"], "s1")
        self.assertEqual(ck["pauseReason"], "usage_limit")
        self.assertEqual(ck["blockedExecutions"][0]["tool"], "Edit")
        self.assertNotIn("agentId", ck)
        self.assertNotIn("toolUseId", ck)

    def test_missing_state_fail_open(self):
        # sem estado → libera sem esperar
        c, s = self._no_sleep_counter()
        rc = barrier.run(self.data, env={}, store=self.store, config=self.cfg, sleep_fn=s)
        self.assertEqual(rc, 0)
        self.assertEqual(c["n"], 0)

    def test_corrupt_state_fail_open(self):
        with open(self.cfg.state_file_path, "w") as f:
            f.write("{ not json")
        c, s = self._no_sleep_counter()
        self.assertEqual(barrier.run(self.data, env={}, store=self.store,
                                     config=self.cfg, sleep_fn=s), 0)

    def test_cap_exceeded_fail_open(self):
        os.environ["GOVERNOR_HOOK_WAIT_TIMEOUT_MS"] = "1000"
        cfg = self.reload_cfg()
        store = GlobalPauseStateStore(cfg)
        store.request_pause("usage_limit", 99.0, None)
        tc = {"t": 0.0}
        def clock():
            return tc["t"]
        def s(_):
            tc["t"] += 0.6
        rc = barrier.run(self.data, env={}, store=store, config=cfg, sleep_fn=s, clock=clock)
        self.assertEqual(rc, 0)
        self.assertTrue(store.read().is_paused())  # ainda pausado, mas liberou (fail-open)


if __name__ == "__main__":
    unittest.main()
