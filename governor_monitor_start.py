#!/usr/bin/env python
"""
SessionStart hook — lança o daemon governor.monitor em background (single-instance).
Rápido e fail-open: qualquer erro é engolido para NUNCA quebrar o início da sessão.
"""
import os
import sys

HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))
if HOOKS_DIR not in sys.path:
    sys.path.insert(0, HOOKS_DIR)


def main() -> int:
    try:
        from governor.monitor import spawn_detached

        launched = spawn_detached()
        # stdout do SessionStart não bloqueia nada; só informativo.
        print("governor monitor:", "launched" if launched else "already running")
    except Exception:
        # fail-open absoluto: início de sessão jamais pode falhar por causa do governor.
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
