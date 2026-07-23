"""
governor.monitor — daemon externo de monitoramento (GOVERNOR_PLAN.md §5, §6).

Loop: coleta métricas → amostra burn rate → decide pausa → atualiza estado atômico →
continua durante a pausa → detecta reset → sinaliza RESUMING→RUNNING.
Single-instance via lockfile + PID (cross-platform). Lançado por SessionStart hook.

FORA do caminho crítico: só o daemon faz rede (§14.3). A barreira apenas lê state.json.
Fail-open por ciclo: erro de métrica/rede → loga e continua, NUNCA pausa por defeito próprio.

Rodar como módulo (imports relativos):  python -m governor.monitor
"""
from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Optional

from .burn_rate import UsageBurnRateCalculator, UsageLimitPredictor
from .config import GovernorConfig, ensure_governor_dir, load_config
from .decision import PauseDecisionEngine
from .metrics import MetricsUnavailable, UsageMetricsProvider, UsageSnapshot, UsageWindow
from .recovery import SessionRecoveryManager
from .remote import RemoteInteractionBridge, combined_notifier
from .reset_detector import ResetDetector
from .state_store import GlobalPauseStateStore


def _log(config: GovernorConfig, msg: str) -> None:
    """Log simples e à prova de falha. NUNCA inclui token/segredo."""
    try:
        os.makedirs(os.path.dirname(config.log_file_path), exist_ok=True)
        with open(config.log_file_path, "a", encoding="utf-8") as f:
            ts = datetime.now(timezone.utc).isoformat()
            f.write(f"{ts} [monitor pid={os.getpid()}] {msg}\n")
    except Exception:
        pass


# --------------------------------------------------------------------------
# Single-instance lock
# --------------------------------------------------------------------------
def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        try:
            import ctypes

            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            STILL_ACTIVE = 259
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if not handle:
                return False
            try:
                code = ctypes.c_ulong()
                if kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
                    return code.value == STILL_ACTIVE
                return True
            finally:
                kernel32.CloseHandle(handle)
        except Exception:
            return False
    else:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
        except OSError:
            return False
        return True


class SingleInstanceLock:
    """Lock por arquivo com PID. Assume o lock se o PID gravado não estiver vivo (stale)."""

    def __init__(self, path: str):
        self._path = path
        self._acquired = False

    def existing_pid(self) -> Optional[int]:
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                return int(f.read().strip())
        except (OSError, ValueError):
            return None

    def is_another_instance_running(self) -> bool:
        pid = self.existing_pid()
        return pid is not None and pid != os.getpid() and _pid_alive(pid)

    def acquire(self) -> bool:
        if self.is_another_instance_running():
            return False
        os.makedirs(os.path.dirname(self._path), exist_ok=True)
        tmp = f"{self._path}.{os.getpid()}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(str(os.getpid()))
        os.replace(tmp, self._path)
        self._acquired = True
        return True

    def release(self) -> None:
        if not self._acquired:
            return
        if self.existing_pid() == os.getpid():
            try:
                os.unlink(self._path)
            except OSError:
                pass
        self._acquired = False


# --------------------------------------------------------------------------
# Monitor
# --------------------------------------------------------------------------
class Monitor:
    def __init__(
        self,
        config: Optional[GovernorConfig] = None,
        provider: Optional[UsageMetricsProvider] = None,
        store: Optional[GlobalPauseStateStore] = None,
        burn: Optional[UsageBurnRateCalculator] = None,
        predictor: Optional[UsageLimitPredictor] = None,
        engine: Optional[PauseDecisionEngine] = None,
        recovery: Optional[SessionRecoveryManager] = None,
        remote: Optional[RemoteInteractionBridge] = None,
    ):
        self._config = config or load_config()
        self._provider = provider or UsageMetricsProvider(self._config)
        self._store = store or GlobalPauseStateStore(self._config)
        self._burn = burn or UsageBurnRateCalculator(self._config)
        self._predictor = predictor or UsageLimitPredictor(self._config)
        self._engine = engine or PauseDecisionEngine(self._config)
        self._remote = remote or RemoteInteractionBridge(self._config)
        self._recovery = recovery or SessionRecoveryManager(
            self._config, notifier=combined_notifier(self._remote)
        )
        self._detectors: Dict[str, ResetDetector] = {}
        self._pause_window_name: Optional[str] = None
        self._stop = False

    def _notify(self, text: str) -> None:
        try:
            self._remote.notify(text)
        except Exception:
            pass  # aviso remoto nunca quebra o loop (fail-open)

    def _detector(self, name: str) -> ResetDetector:
        det = self._detectors.get(name)
        if det is None:
            det = ResetDetector(self._config)
            self._detectors[name] = det
        return det

    @staticmethod
    def _pressure_window(snapshot: UsageSnapshot) -> Optional[str]:
        best_name, best_util = None, -1.0
        for name, w in snapshot.windows.items():
            if w.utilization is not None and w.utilization > best_util:
                best_util, best_name = w.utilization, name
        return best_name

    @staticmethod
    def _reset_at_iso(window: Optional[UsageWindow]) -> Optional[str]:
        if window and isinstance(window.resets_at, datetime):
            return window.resets_at.isoformat()
        return None

    def run_once(self) -> None:
        """Um ciclo do loop. Fail-open: qualquer falha de métrica → loga e retorna."""
        try:
            snapshot = self._provider.fetch_usage()
        except MetricsUnavailable as e:
            _log(self._config, f"metrics unavailable ({e}); fail-open, no state change")
            return

        # Atualiza detectores de reset p/ TODAS as janelas (histórico contínuo).
        events = {name: self._detector(name).observe(w) for name, w in snapshot.windows.items()}

        max_util = snapshot.max_utilization()
        if max_util is None:
            _log(self._config, "no utilization in snapshot; fail-open, no state change")
            return
        pressure = self._pressure_window(snapshot)

        current = self._store.read()

        if not current.is_paused():
            # ---- RODANDO: amostra + decide pausa ----
            self._burn.add_sample(max_util)
            rate = self._burn.burn_rate_per_min()
            minutes = self._predictor.minutes_to_100(max_util, rate)
            decision = self._engine.decide(max_util, minutes, in_flight_requests=0)
            if decision.should_pause:
                reset_at = self._reset_at_iso(snapshot.window(pressure))
                self._store.request_pause(decision.reason, decision.effective_utilization, reset_at)
                self._store.mark_waiting_for_reset(decision.effective_utilization, reset_at)
                self._pause_window_name = pressure
                _log(
                    self._config,
                    f"PAUSE reason={decision.reason} window={pressure} "
                    f"util={decision.effective_utilization:.1f}% minutes_to_100={minutes} reset_at={reset_at}",
                )
                self._notify(
                    f"Governor: uso em {decision.effective_utilization:.0f}% (janela {pressure}). "
                    f"Pausando ferramentas; reset previsto para {reset_at or 'desconhecido'}."
                )
            return

        # ---- PAUSADO: procura reset p/ retomar ----
        watch = self._pause_window_name or pressure
        win = snapshot.window(watch) if watch else None
        ev = events.get(watch) if watch else None
        reset_detected = bool(ev and ev.detected)
        available = self._detector(watch or "").is_resource_available(win) if watch else True

        if reset_detected or available:
            self._store.mark_resuming()
            self._burn.reset()
            self._store.mark_running()
            reason = "reset_detected" if reset_detected else "resource_available"
            _log(self._config, f"RESUME ({reason}) window={watch} util={win.utilization if win else None}")
            self._notify("Governor: limite resetado; execução retomada automaticamente.")
            self._pause_window_name = None
            # Fallback assistido: se algum barrier desistiu (hook-morto), avisa o usuário
            # com o comando `claude --resume <id>` pronto.
            try:
                notified = self._recovery.check_and_notify(reset_happened=True)
                if notified:
                    _log(self._config, "recovery notice emitted (assisted --resume)")
            except Exception:
                pass
        else:
            _log(
                self._config,
                f"still paused window={watch} util={win.utilization if win else None}",
            )

    def run(self) -> int:
        lock = SingleInstanceLock(self._config.lock_file_path)
        if not lock.acquire():
            _log(self._config, "another instance is running; exiting")
            return 0

        def _handle_signal(signum, frame):
            self._stop = True

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                signal.signal(sig, _handle_signal)
            except (ValueError, OSError):
                pass

        interval = max(1.0, self._config.monitoring_interval_ms / 1000.0)
        _log(self._config, f"monitor started; interval={interval}s state={self._store.path}")
        try:
            while not self._stop:
                try:
                    self.run_once()
                except Exception as e:  # nunca deixar o loop morrer por um ciclo ruim
                    _log(self._config, f"cycle error ({type(e).__name__}: {e}); continuing")
                # sleep responsivo a stop
                slept = 0.0
                while slept < interval and not self._stop:
                    step = min(1.0, interval - slept)
                    time.sleep(step)
                    slept += step
        finally:
            lock.release()
            _log(self._config, "monitor stopped")
        return 0


# --------------------------------------------------------------------------
# CLI / lançamento
# --------------------------------------------------------------------------
def spawn_detached() -> bool:
    """
    Lança o monitor em background desanexado (usado pelo SessionStart hook).
    Retorna False se já houver instância viva. Retorna True se lançou (ou tentou).
    """
    config = load_config()
    ensure_governor_dir()
    lock = SingleInstanceLock(config.lock_file_path)
    if lock.is_another_instance_running():
        return False

    hooks_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    kwargs = dict(cwd=hooks_dir, stdin=subprocess.DEVNULL,
                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.name == "nt":
        DETACHED_PROCESS = 0x00000008
        CREATE_NEW_PROCESS_GROUP = 0x00000200
        CREATE_NO_WINDOW = 0x08000000
        kwargs["creationflags"] = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW
    else:
        kwargs["start_new_session"] = True
    subprocess.Popen([sys.executable, "-m", "governor.monitor", "--run"], **kwargs)
    return True


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="governor.monitor")
    parser.add_argument("--run", action="store_true", help="roda o loop do daemon (default)")
    parser.add_argument("--once", action="store_true", help="roda um único ciclo e sai")
    parser.add_argument("--spawn", action="store_true", help="lança o daemon desanexado e sai")
    args = parser.parse_args(argv)

    if args.spawn:
        launched = spawn_detached()
        print("launched" if launched else "already-running")
        return 0
    if args.once:
        Monitor().run_once()
        return 0
    return Monitor().run()


if __name__ == "__main__":
    raise SystemExit(main())
