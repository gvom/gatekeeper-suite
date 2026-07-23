import os
import unittest
from datetime import timedelta

from governor.monitor import Monitor, SingleInstanceLock, _pid_alive
import governor.monitor as mon
from governor.inflight import InflightTracker
from governor.state_store import GlobalPauseStateStore, PAUSED_WAITING_FOR_RESET
from .base import GovernorTestCase
from .fakes import FakeProvider, base_dt


class TestSingleInstanceLock(GovernorTestCase):
    def test_pid_alive(self):
        self.assertTrue(_pid_alive(os.getpid()))
        self.assertFalse(_pid_alive(999999))

    def test_acquire_and_release(self):
        p = os.path.join(self.tmpdir, "x.lock")
        lk = SingleInstanceLock(p)
        self.assertTrue(lk.acquire())
        self.assertEqual(lk.existing_pid(), os.getpid())
        lk.release()
        self.assertIsNone(lk.existing_pid())

    def test_takeover_stale(self):
        p = os.path.join(self.tmpdir, "x.lock")
        with open(p, "w") as f:
            f.write("999999")
        lk = SingleInstanceLock(p)
        self.assertFalse(lk.is_another_instance_running())
        self.assertTrue(lk.acquire())

    def test_blocked_by_live_instance(self):
        p = os.path.join(self.tmpdir, "x.lock")
        with open(p, "w") as f:
            f.write(str(os.getpid() + 1))
        orig = mon._pid_alive
        mon._pid_alive = lambda pid: True
        try:
            lk = SingleInstanceLock(p)
            self.assertTrue(lk.is_another_instance_running())
            self.assertFalse(lk.acquire())
        finally:
            mon._pid_alive = orig


class TestMonitorCycle(GovernorTestCase):
    def setUp(self):
        super().setUp()
        self.store = GlobalPauseStateStore(self.cfg)
        self.fp = FakeProvider()
        self.m = Monitor(config=self.cfg, provider=self.fp, store=self.store)
        self.base = base_dt()

    def test_normal_running(self):
        self.fp.set(50.0, self.base)
        self.m.run_once()
        s = self.store.read()
        self.assertTrue(s.allows_execution())
        self.assertFalse(s.is_paused())

    def test_pause_on_threshold(self):
        self.fp.set(96.0, self.base)
        self.m.run_once()
        s = self.store.read()
        self.assertEqual(s.state, PAUSED_WAITING_FOR_RESET)
        self.assertFalse(s.allows_execution())

    def test_stays_paused_same_window(self):
        self.fp.set(96.0, self.base); self.m.run_once()
        self.fp.set(96.0, self.base); self.m.run_once()
        self.assertTrue(self.store.read().is_paused())

    def test_resume_on_resets_advanced(self):
        self.fp.set(96.0, self.base); self.m.run_once()
        self.fp.set(94.0, self.base + timedelta(hours=5)); self.m.run_once()
        self.assertTrue(self.store.read().allows_execution())

    def test_resume_on_resource_available(self):
        self.fp.set(97.0, self.base); self.m.run_once()
        self.assertTrue(self.store.read().is_paused())
        self.fp.set(30.0, self.base); self.m.run_once()
        self.assertTrue(self.store.read().allows_execution())

    def test_inflight_pushes_over_threshold(self):
        # util 94 sozinho não pausa; com 2 chamadas in-flight (2*1.0%) vira 96 ≥ 95 → pausa
        tr = InflightTracker(self.cfg)
        m = Monitor(config=self.cfg, provider=self.fp, store=self.store, inflight=tr)
        self.fp.set(94.0, self.base)
        m.run_once()
        self.assertFalse(self.store.read().is_paused())  # 94 < 95
        tr.record_start(); tr.record_start()
        self.fp.set(94.0, self.base)
        m.run_once()
        self.assertTrue(self.store.read().is_paused())    # 94 + 2 = 96 ≥ 95

    def test_metrics_unavailable_fail_open(self):
        self.store.mark_running()
        v = self.store.read().version
        self.fp.fail()
        self.m.run_once()
        self.assertEqual(self.store.read().version, v)
        self.assertTrue(self.store.read().allows_execution())


if __name__ == "__main__":
    unittest.main()
