#!/usr/bin/env python
"""
PostToolUse hook — marca o fim de uma chamada de ferramenta (contagem in-flight do Governor).
Remove o marcador mais antigo. Rápido e fail-open: nunca imprime nem falha o fluxo.
Não precisa de stdin; sai 0 sempre.
"""
import os
import sys

HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))
if HOOKS_DIR not in sys.path:
    sys.path.insert(0, HOOKS_DIR)


def main() -> int:
    try:
        from governor.inflight import InflightTracker

        InflightTracker().record_end()
    except Exception:
        pass  # fail-open absoluto
    return 0


if __name__ == "__main__":
    sys.exit(main())
