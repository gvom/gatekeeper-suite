import unittest
from datetime import timedelta

from governor.burn_rate import UsageBurnRateCalculator, UsageLimitPredictor
from governor.decision import PauseDecisionEngine
from governor.reset_detector import ResetDetector
from governor.metrics import UsageWindow
from .base import GovernorTestCase
from .fakes import base_dt


class _Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t

    def advance(self, s):
        self.t += s


class TestBurnRate(GovernorTestCase):
    def test_no_samples(self):
        brc = UsageBurnRateCalculator(self.cfg, clock=_Clock())
        self.assertIsNone(brc.burn_rate_per_min())

    def test_rate_rising(self):
        clk = _Clock()
        brc = UsageBurnRateCalculator(self.cfg, clock=clk)
        brc.add_sample(50.0)
        clk.advance(60); brc.add_sample(52.0)
        clk.advance(60); brc.add_sample(54.0)
        self.assertTrue(brc.has_enough_samples())
        self.assertAlmostEqual(brc.burn_rate_per_min(), 2.0, places=6)

    def test_none_ignored(self):
        brc = UsageBurnRateCalculator(self.cfg, clock=_Clock())
        brc.add_sample(50.0); brc.add_sample(None)
        self.assertEqual(brc.sample_count(), 1)

    def test_prune_window(self):
        clk = _Clock()
        brc = UsageBurnRateCalculator(self.cfg, clock=clk)
        brc.add_sample(50.0)
        clk.advance(10_000); brc.add_sample(90.0)
        self.assertEqual(brc.sample_count(), 1)

    def test_rate_negative_after_drop(self):
        clk = _Clock()
        brc = UsageBurnRateCalculator(self.cfg, clock=clk)
        brc.add_sample(95.0); clk.advance(60); brc.add_sample(60.0); clk.advance(60); brc.add_sample(20.0)
        self.assertLess(brc.burn_rate_per_min(), 0)


class TestPredictor(GovernorTestCase):
    def test_predictions(self):
        p = UsageLimitPredictor(self.cfg)
        self.assertIsNone(p.minutes_to_100(80.0, None))
        self.assertEqual(p.minutes_to_100(80.0, -1.0), float("inf"))
        self.assertEqual(p.minutes_to_100(80.0, 0.0), float("inf"))
        self.assertAlmostEqual(p.minutes_to_100(80.0, 2.0), 10.0, places=6)
        self.assertEqual(p.minutes_to_100(100.0, 5.0), 0.0)


class TestDecision(GovernorTestCase):
    def setUp(self):
        super().setUp()
        self.eng = PauseDecisionEngine(self.cfg)  # max 95, margin 2min

    def test_normal_no_pause(self):
        d = self.eng.decide(50.0, None)
        self.assertFalse(d.should_pause)

    def test_threshold_pause(self):
        d = self.eng.decide(96.0, None)
        self.assertTrue(d.should_pause)
        self.assertEqual(d.reason, "usage_threshold")

    def test_in_flight_pushes_over(self):
        d = self.eng.decide(94.0, None, in_flight_requests=2)
        self.assertTrue(d.should_pause)
        self.assertAlmostEqual(d.effective_utilization, 96.0, places=6)

    def test_predictive_pause(self):
        d = self.eng.decide(80.0, minutes_to_100=1.5)
        self.assertTrue(d.should_pause)
        self.assertEqual(d.reason, "predictive")

    def test_predictive_no_pause_when_far(self):
        self.assertFalse(self.eng.decide(80.0, minutes_to_100=5.0).should_pause)

    def test_insufficient_samples_below_threshold(self):
        self.assertFalse(self.eng.decide(90.0, None).should_pause)

    def test_total_limit_change_via_config(self):
        import os
        from governor.config import load_config
        os.environ["GOVERNOR_MAXIMUM_USAGE_PERCENTAGE"] = "85"
        eng = PauseDecisionEngine(load_config())
        self.assertTrue(eng.decide(86.0, None).should_pause)


class TestResetDetector(GovernorTestCase):
    def setUp(self):
        super().setUp()
        self.base = base_dt()

    def test_first_observe_no_reset(self):
        det = ResetDetector(self.cfg)
        self.assertFalse(det.observe(UsageWindow("five_hour", 96.0, self.base)).detected)

    def test_small_dip_no_reset(self):
        det = ResetDetector(self.cfg)
        det.observe(UsageWindow("five_hour", 96.0, self.base))
        self.assertFalse(det.observe(UsageWindow("five_hour", 90.0, self.base)).detected)

    def test_resets_at_advanced(self):
        det = ResetDetector(self.cfg)
        det.observe(UsageWindow("five_hour", 96.0, self.base))
        ev = det.observe(UsageWindow("five_hour", 5.0, self.base + timedelta(hours=5)))
        self.assertTrue(ev.detected)
        self.assertEqual(ev.reason, "resets_at_advanced")

    def test_big_drop_to_low(self):
        det = ResetDetector(self.cfg)
        det.observe(UsageWindow("five_hour", 95.0, self.base))
        ev = det.observe(UsageWindow("five_hour", 10.0, self.base))
        self.assertTrue(ev.detected)
        self.assertEqual(ev.reason, "utilization_dropped")

    def test_big_drop_still_high_no_reset(self):
        det = ResetDetector(self.cfg)
        det.observe(UsageWindow("five_hour", 95.0, self.base))
        self.assertFalse(det.observe(UsageWindow("five_hour", 70.0, self.base)).detected)

    def test_resource_available(self):
        det = ResetDetector(self.cfg)
        self.assertTrue(det.is_resource_available(UsageWindow("x", 40.0, self.base)))
        self.assertFalse(det.is_resource_available(UsageWindow("x", 60.0, self.base)))
        self.assertTrue(det.is_resource_available(UsageWindow("x", None, self.base)))


if __name__ == "__main__":
    unittest.main()
