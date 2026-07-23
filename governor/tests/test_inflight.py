import os
import unittest

from governor.inflight import InflightTracker
from .base import GovernorTestCase


class TestInflight(GovernorTestCase):
    def setUp(self):
        super().setUp()
        self.tr = InflightTracker(self.cfg)

    def test_start_increments(self):
        self.assertEqual(self.tr.count(), 0)
        self.tr.record_start()
        self.tr.record_start()
        self.assertEqual(self.tr.count(), 2)

    def test_end_removes_oldest(self):
        self.tr.record_start()
        self.tr.record_start()
        self.tr.record_end()
        self.assertEqual(self.tr.count(), 1)
        self.tr.record_end()
        self.assertEqual(self.tr.count(), 0)

    def test_end_on_empty_is_safe(self):
        self.tr.record_end()  # não deve levantar
        self.assertEqual(self.tr.count(), 0)

    def test_clear(self):
        for _ in range(3):
            self.tr.record_start()
        self.assertEqual(self.tr.count(), 3)
        self.tr.clear()
        self.assertEqual(self.tr.count(), 0)

    def test_stale_marker_pruned(self):
        # cria um marcador antigo (ano 2001) manualmente → deve ser podado pelo TTL
        os.makedirs(self.cfg.inflight_dir_path, exist_ok=True)
        stale = os.path.join(self.cfg.inflight_dir_path, "1000000000.000000-1-deadbeef")
        with open(stale, "w") as f:
            f.write("1000000000.0")
        self.tr.record_start()  # 1 vivo
        self.assertEqual(self.tr.count(), 1)  # o velho foi podado
        self.assertFalse(os.path.exists(stale))

    def test_count_missing_dir_zero(self):
        # sem diretório ainda criado → 0 (fail-open)
        tr = InflightTracker(self.cfg)
        self.assertEqual(tr.count(), 0)


if __name__ == "__main__":
    unittest.main()
