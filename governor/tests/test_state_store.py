import json
import os
import unittest

from governor.state_store import (
    GlobalPauseStateStore, RUNNING, RESUMING, FAILED, PAUSED_WAITING_FOR_RESET,
)
from .base import GovernorTestCase


class TestStateStore(GovernorTestCase):
    def setUp(self):
        super().setUp()
        self.store = GlobalPauseStateStore(self.cfg)

    def test_missing_state_fail_open(self):
        s = self.store.read()
        self.assertTrue(s.allows_execution())
        self.assertTrue(s.synthetic_fail_open)
        self.assertFalse(s.is_paused())

    def test_running_allows(self):
        s = self.store.mark_running()
        self.assertEqual(s.version, 1)
        self.assertTrue(self.store.read().allows_execution())

    def test_pause_blocks_and_bumps_version(self):
        self.store.mark_running()
        s = self.store.request_pause("usage_limit", 96.5, "2026-07-23T02:00:00+00:00")
        self.assertFalse(self.store.read().allows_execution())
        self.assertEqual(s.version, 2)
        self.assertAlmostEqual(s.remaining_usage, 3.5, places=6)

    def test_waiting_for_reset_is_paused(self):
        self.store.mark_waiting_for_reset(98.7, "2026-07-23T02:00:00+00:00")
        r = self.store.read()
        self.assertTrue(r.is_paused())
        self.assertEqual(r.state, PAUSED_WAITING_FOR_RESET)

    def test_idempotent_transition_no_bump(self):
        self.store.mark_waiting_for_reset(98.7, "R")
        v = self.store.read().version
        self.store.mark_waiting_for_reset(98.7, "R")
        self.assertEqual(self.store.read().version, v)

    def test_resume_cycle_allows(self):
        self.store.request_pause("usage_limit", 99.0, "R")
        self.store.mark_resuming()
        self.assertTrue(self.store.read().allows_execution())
        self.store.mark_running()
        self.assertTrue(self.store.read().allows_execution())

    def test_failed_is_fail_open(self):
        self.store.mark_failed("boom")
        s = self.store.read()
        self.assertEqual(s.state, FAILED)
        self.assertTrue(s.allows_execution())  # fail-open
        self.assertFalse(s.is_paused())

    def test_corrupted_fail_open(self):
        with open(self.cfg.state_file_path, "w", encoding="utf-8") as f:
            f.write("{ not valid json ")
        s = self.store.read()
        self.assertTrue(s.allows_execution())
        self.assertTrue(s.synthetic_fail_open)

    def test_unknown_state_fail_open(self):
        with open(self.cfg.state_file_path, "w", encoding="utf-8") as f:
            json.dump({"state": "WAT", "version": 5}, f)
        self.assertTrue(self.store.read().allows_execution())

    def test_disk_json_wellformed(self):
        self.store.mark_running()
        with open(self.cfg.state_file_path, encoding="utf-8") as f:
            disk = json.load(f)
        self.assertTrue({"version", "state", "paused"} <= set(disk.keys()))


if __name__ == "__main__":
    unittest.main()
