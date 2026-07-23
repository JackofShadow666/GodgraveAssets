"""Restore modular files from a Build.standalone.html created by build.py.

Usage:
    python tools/split.py
    python tools/split.py --input Build.standalone.html --output Build.html
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BUNDLED_SCRIPT = re.compile(
    r'<script>\s*// === bundled: (?P<path>src/[^\n<>]+\.js) ===\n(?P<body>.*?)\n</script>',
    re.DOTALL,
)


def module_path(relative_path: str) -> Path:
    path = (ROOT / relative_path).resolve()
    if ROOT not in path.parents:
        raise ValueError(f"Unsafe module path: {relative_path}")
    return path


def restore_module(match: re.Match[str]) -> str:
    relative_path = match.group("path")
    path = module_path(relative_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(match.group("body"), encoding="utf-8", newline="\n")
    restored.append(relative_path)
    return f'<script src="{relative_path}"></script>'


def main() -> None:
    parser = argparse.ArgumentParser(description="Split a Godgrave standalone build into modules.")
    parser.add_argument("--input", default="Build.standalone.html", help="portable input HTML (relative to project root)")
    parser.add_argument("--output", default="Build.html", help="modular entry HTML (relative to project root)")
    args = parser.parse_args()

    input_path = ROOT / args.input
    output_path = ROOT / args.output
    html = input_path.read_text(encoding="utf-8")

    global restored
    restored = []
    modular = BUNDLED_SCRIPT.sub(restore_module, html)
    if not restored:
        raise RuntimeError("No bundled module markers were found; this is not a build created by tools/build.py.")

    output_path.write_text(modular, encoding="utf-8", newline="\n")
    print(f"Restored {len(restored)} modules and created {output_path.name}.")


if __name__ == "__main__":
    main()
