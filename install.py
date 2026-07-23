#!/usr/bin/env python
"""
gatekeeper-suite — instalador idempotente e cross-platform.

- Detecta ~/.claude (respeita CLAUDE_CONFIG_DIR).
- Copia gatekeeper, o pacote governor e os hooks standalone para <config>/hooks/.
- pip install -r requirements.txt (best-effort).
- Merge SEGURO dos blocos de hook no settings.json (não apaga hooks do usuário,
  não toca em envs/keys existentes; escrita atômica com backup .bak).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable or "python"

# Console Windows (cp1252) não encoda alguns caracteres; força UTF-8 se possível.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def config_dir() -> str:
    override = os.getenv("CLAUDE_CONFIG_DIR")
    base = os.path.expanduser(override) if override else os.path.expanduser(os.path.join("~", ".claude"))
    return os.path.abspath(base)


def _copy_file(src: str, dst: str) -> None:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    print(f"  copiado: {os.path.relpath(dst, config_dir())}")


def _copy_package(src_dir: str, dst_dir: str) -> None:
    for root, _dirs, files in os.walk(src_dir):
        if "__pycache__" in root:
            continue
        for name in files:
            if name.endswith(".pyc"):
                continue
            s = os.path.join(root, name)
            rel = os.path.relpath(s, src_dir)
            _copy_file(s, os.path.join(dst_dir, rel))


def copy_code(hooks_dir: str) -> None:
    print("Copiando código para", hooks_dir)
    _copy_file(os.path.join(REPO, "gatekeeper", "gatekeeper.py"), os.path.join(hooks_dir, "gatekeeper.py"))
    _copy_package(os.path.join(REPO, "governor"), os.path.join(hooks_dir, "governor"))
    _copy_file(os.path.join(REPO, "governor_barrier.py"), os.path.join(hooks_dir, "governor_barrier.py"))
    _copy_file(os.path.join(REPO, "governor_monitor_start.py"), os.path.join(hooks_dir, "governor_monitor_start.py"))
    _copy_file(os.path.join(REPO, "governor_inflight_end.py"), os.path.join(hooks_dir, "governor_inflight_end.py"))


def install_deps() -> None:
    req = os.path.join(REPO, "requirements.txt")
    if not os.path.exists(req):
        return
    print("Instalando dependências (gatekeeper)...")
    try:
        subprocess.run([PY, "-m", "pip", "install", "-r", req], check=False)
    except Exception as e:  # noqa: BLE001
        print(f"  aviso: pip falhou ({e}); instale manualmente: pip install -r requirements.txt")


def _cmd(hooks_dir: str, script: str) -> str:
    return f'{PY} "{os.path.join(hooks_dir, script)}"'


def _hook_specs(hooks_dir: str):
    """(evento, script_basename, bloco, prepend?)."""
    barrier = {
        "matcher": "*",
        "hooks": [{"type": "command", "command": _cmd(hooks_dir, "governor_barrier.py"), "timeout": 21600}],
    }
    gk_bash = {
        "matcher": "Bash",
        "hooks": [{"type": "command", "command": _cmd(hooks_dir, "gatekeeper.py"), "timeout": 420}],
    }
    gk_edit = {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{"type": "command", "command": _cmd(hooks_dir, "gatekeeper.py"), "timeout": 420}],
    }
    gk_perm = {
        "matcher": ".*",
        "hooks": [{"type": "command", "command": _cmd(hooks_dir, "gatekeeper.py"), "timeout": 420}],
    }
    gk_prompt = {
        "matcher": ".*",
        "hooks": [{"type": "command", "command": _cmd(hooks_dir, "gatekeeper.py"), "timeout": 10}],
    }
    monitor = {
        "matcher": ".*",
        "hooks": [{"type": "command", "command": _cmd(hooks_dir, "governor_monitor_start.py"),
                   "timeout": 10, "statusMessage": "Starting governor monitor..."}],
    }
    inflight_end = {
        "matcher": "*",
        "hooks": [{"type": "command", "command": _cmd(hooks_dir, "governor_inflight_end.py"), "timeout": 10}],
    }
    return [
        ("PreToolUse", "governor_barrier.py", barrier, True),
        ("PreToolUse", "gatekeeper.py::Bash", gk_bash, False),
        ("PreToolUse", "gatekeeper.py::Edit", gk_edit, False),
        ("PermissionRequest", "gatekeeper.py", gk_perm, False),
        ("UserPromptSubmit", "gatekeeper.py", gk_prompt, False),
        ("SessionStart", "governor_monitor_start.py", monitor, False),
        ("PostToolUse", "governor_inflight_end.py", inflight_end, False),
    ]


def _block_present(existing_blocks, script: str, matcher: str) -> bool:
    base = script.split("::", 1)[0]
    for blk in existing_blocks:
        if matcher and blk.get("matcher") != matcher:
            continue
        for h in blk.get("hooks", []):
            if base in str(h.get("command", "")):
                return True
    return False


def merge_settings(hooks_dir: str) -> None:
    settings_path = os.path.join(config_dir(), "settings.json")
    data = {}
    if os.path.exists(settings_path):
        try:
            with open(settings_path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            print("  aviso: settings.json ilegível; criando estrutura mínima (backup em .bak)")
            data = {}
    if not isinstance(data, dict):
        data = {}
    hooks = data.setdefault("hooks", {})
    added = 0
    for event, script, block, prepend in _hook_specs(hooks_dir):
        blocks = hooks.setdefault(event, [])
        if _block_present(blocks, script, block["matcher"]):
            continue
        if prepend:
            blocks.insert(0, block)
        else:
            blocks.append(block)
        added += 1
        print(f"  + hook {event} [{block['matcher']}] ({script})")
    if os.path.exists(settings_path):
        shutil.copy2(settings_path, settings_path + ".bak")
    _atomic_write_json(settings_path, data)
    print(f"settings.json atualizado ({added} bloco(s) novo(s); backup .bak salvo).")


def _atomic_write_json(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".settings-", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def main() -> int:
    cfg = config_dir()
    hooks_dir = os.path.join(cfg, "hooks")
    print(f"Config dir: {cfg}")
    copy_code(hooks_dir)
    install_deps()
    merge_settings(hooks_dir)
    print("\n[OK] Instalado. Proximos passos:")
    print("  1. cp .env.example .env  e preencha as chaves desejadas (ou use Ollama sem chave).")
    print(f'  2. Validar:  {PY} "{os.path.join(hooks_dir, "gatekeeper.py")}" validate')
    print("  3. No Claude Code:  gk status")
    print("  O monitor do Governor sobe no próximo SessionStart. A barreira já vale.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
