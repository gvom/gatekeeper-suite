import os
import unittest

from governor.metrics import (
    UsageMetricsProvider, MetricsUnavailable, _parse_windows, _parse_resets_at,
)
from .base import GovernorTestCase


class TestMetricsParse(GovernorTestCase):
    def test_parse_windows_generic(self):
        payload = {
            "five_hour": {"utilization": 64.0, "resets_at": "2026-07-23T02:10:00+00:00"},
            "seven_day": {"utilization": 40.0, "resets_at": "2026-07-28T15:59:59+00:00"},
            "seven_day_opus": None,
            "codename_dict": {"utilization": 10.0},  # sem resets_at → ignorado
            "extra_usage": {"utilization": None, "resets_at": None},  # aceito, util None
            "scalar": 5,
        }
        w = _parse_windows(payload)
        self.assertIn("five_hour", w)
        self.assertIn("seven_day", w)
        self.assertNotIn("seven_day_opus", w)
        self.assertNotIn("codename_dict", w)
        self.assertNotIn("scalar", w)
        self.assertEqual(w["five_hour"].utilization, 64.0)

    def test_parse_resets_at_z_suffix(self):
        dt = _parse_resets_at("2026-07-23T02:10:00Z")
        self.assertIsNotNone(dt)
        self.assertIsNotNone(dt.tzinfo)

    def test_parse_resets_at_invalid(self):
        self.assertIsNone(_parse_resets_at("garbage"))
        self.assertIsNone(_parse_resets_at(None))

    def test_missing_token_raises(self):
        # aponta credentials p/ arquivo inexistente
        os.environ["CLAUDE_CONFIG_DIR"] = self.tmpdir  # sem .credentials.json aqui
        try:
            prov = UsageMetricsProvider(self.cfg)
            with self.assertRaises(MetricsUnavailable):
                prov.fetch_usage(force=True)
        finally:
            os.environ.pop("CLAUDE_CONFIG_DIR", None)


class TestMetricsLive(GovernorTestCase):
    @unittest.skipUnless(os.getenv("GOVERNOR_LIVE_TEST") == "1", "live test opt-in")
    def test_live_fetch(self):
        prov = UsageMetricsProvider(self.cfg)
        snap = prov.fetch_usage(force=True)
        self.assertIsNotNone(snap.five_hour)
        self.assertIsInstance(snap.max_utilization(), float)


if __name__ == "__main__":
    unittest.main()
