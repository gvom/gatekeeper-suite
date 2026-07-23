#!/usr/bin/env python
"""
gatekeeper-suite — desinstalador. Remove os arquivos de hook copiados e os blocos
de hook da suíte no settings.json, deixando intactos os demais hooks, envs e o .env.
Não apaga chaves nem dados do usuário.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile

SCRIPTS = ("gatekeeper.py", "governor_barrier.py", "governor_monitor_start.py")

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def config_dir() -> str:
    override = os.getenv("CLAUDE_CONFIG_DIR")
    base = os.path.expanduser(override) if override else os.path.expanduser(os.path.join("~", ".claude"))
    return os.path.abspath(base)


def _atomic_write_json(path: str, data: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".settings-", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _strip_blocks(hooks: dict) -> int:
    removed = 0
    for event, blocks in list(hooks.items()):
        if not isinstance(blocks, list):
            continue
        kept = []
        for blk in blocks:
            cmds = " ".join(str(h.get("command", "")) for h in blk.get("hooks", []))
            if any(s in cmds for s in SCRIPTS):
                removed += 1
            else:
                kept.append(blk)
        hooks[event] = kept
    return removed


def main() -> int:
    cfg = config_dir()
    hooks_dir = os.path.join(cfg, "hooks")

    # remove arquivos copiados
    for s in SCRIPTS:
        p = os.path.join(hooks_dir, s)
        if os.path.exists(p):
            os.remove(p)
            print(f"  removido: {s}")
    gov = os.path.join(hooks_dir, "governor")
    if os.path.isdir(gov):
        shutil.rmtree(gov, ignore_errors=True)
        print("  removido: governor/")

    # limpa settings.json
    settings_path = os.path.join(cfg, "settings.json")
    if os.path.exists(settings_path):
        try:
            with open(settings_path, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("hooks"), dict):
                shutil.copy2(settings_path, settings_path + ".bak")
                n = _strip_blocks(data["hooks"])
                _atomic_write_json(settings_path, data)
                print(f"settings.json limpo ({n} bloco(s) removido(s); backup .bak).")
        except (OSError, ValueError):
            print("  aviso: settings.json ilegível; não modificado.")

    print("\n[OK] Desinstalado. Seu .env e suas chaves foram preservados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
