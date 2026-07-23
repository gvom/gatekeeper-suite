"""Base de teste: tmp dir + env de caminhos isolados + config fresca."""
import os
import shutil
import tempfile
import unittest

from governor.config import load_config

_PATH_ENVS = (
    "GOVERNOR_STATE_FILE_PATH",
    "GOVERNOR_CHECKPOINT_PATH",
    "GOVERNOR_LOG_FILE_PATH",
    "GOVERNOR_LOCK_FILE_PATH",
)
_TUNING_ENVS = (
    "GOVERNOR_HOOK_WAIT_TIMEOUT_MS",
    "GOVERNOR_RESET_CHECK_INTERVAL_MS",
    "GOVERNOR_MAXIMUM_USAGE_PERCENTAGE",
    "GATEKEEPER_REMOTE",
)


class GovernorTestCase(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="gov-test-")
        os.environ["GOVERNOR_STATE_FILE_PATH"] = os.path.join(self.tmpdir, "state.json")
        os.environ["GOVERNOR_CHECKPOINT_PATH"] = os.path.join(self.tmpdir, "checkpoint.json")
        os.environ["GOVERNOR_LOG_FILE_PATH"] = os.path.join(self.tmpdir, "governor.log")
        os.environ["GOVERNOR_LOCK_FILE_PATH"] = os.path.join(self.tmpdir, "monitor.lock")
        for k in _TUNING_ENVS:
            os.environ.pop(k, None)
        self.cfg = load_config()

    def reload_cfg(self):
        self.cfg = load_config()
        return self.cfg

    def tearDown(self):
        for k in _PATH_ENVS + _TUNING_ENVS:
            os.environ.pop(k, None)
        shutil.rmtree(self.tmpdir, ignore_errors=True)
