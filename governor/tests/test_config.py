import os
import unittest

from governor.config import load_config
from .base import GovernorTestCase


class TestConfig(GovernorTestCase):
    def test_defaults(self):
        self.assertEqual(self.cfg.maximum_usage_percentage, 95.0)
        self.assertEqual(self.cfg.reset_check_interval_ms, 15000)
        self.assertEqual(self.cfg.minimum_available_percentage_to_resume, 50.0)
        self.assertEqual(self.cfg.reset_min_utilization_drop, 20.0)

    def test_hook_cap_below_hook_timeout(self):
        # teto de espera deve ser < timeout do hook (21600s)
        self.assertLess(self.cfg.hook_wait_timeout_ms, 21_600_000)

    def test_env_override(self):
        os.environ["GOVERNOR_MAXIMUM_USAGE_PERCENTAGE"] = "80"
        cfg = load_config()
        self.assertEqual(cfg.maximum_usage_percentage, 80.0)

    def test_invalid_env_falls_back(self):
        os.environ["GOVERNOR_MAXIMUM_USAGE_PERCENTAGE"] = "not-a-number"
        cfg = load_config()
        self.assertEqual(cfg.maximum_usage_percentage, 95.0)

    def test_paths_from_env(self):
        self.assertEqual(self.cfg.state_file_path, os.environ["GOVERNOR_STATE_FILE_PATH"])


if __name__ == "__main__":
    unittest.main()
