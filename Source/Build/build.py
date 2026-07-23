"""Build a portable Godgrave HTML file from the modular source tree.

Every local JavaScript file linked by a ``<script src="...">`` tag in the
entry HTML is inlined, in the same order.  To add a new module, add its script
tag to Build.html; no changes to this builder are required.

Usage:
    python build.py
    python build.py --input Build.html --output Build.standalone.html
    python build.py --pause
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
# Accept arbitrary attributes (for example charset="utf-8") and any local JS
# path.  Remote URLs are deliberately left external.
LOCAL_SCRIPT = re.compile(
    r'<script\b(?P<before>[^>]*?)\bsrc\s*=\s*["\'](?P<src>[^"\']+\.js)["\'](?P<after>[^>]*)>\s*</script>',
    re.IGNORECASE,
)


def module_path(relative_path: str) -> Path | None:
    """Resolve a loader path without allowing it to leave the project root."""
    if re.match(r'^[a-z][a-z0-9+.-]*:', relative_path, re.IGNORECASE) or relative_path.startswith('//'):
        return None
    path = (ROOT / relative_path).resolve()
    if path != ROOT and ROOT not in path.parents:
        raise ValueError(f"Unsafe module path: {relative_path}")
    return path


def inline_module(match: re.Match[str]) -> str:
    relative_path = match.group('src')
    path = module_path(relative_path)
    if path is None:
        return match.group(0)
    if not path.is_file():
        raise FileNotFoundError(f"Module referenced by Build.html is missing: {relative_path}")

    source = path.read_text(encoding="utf-8")
    return f'<script>\n// === bundled: {relative_path} ===\n{source}\n</script>'


def main() -> None:
    parser = argparse.ArgumentParser(description="Inline local Godgrave modules into one HTML file.")
    parser.add_argument("--input", default="Build.html", help="modular entry HTML (relative to project root)")
    parser.add_argument("--output", default="Build.standalone.html", help="portable output HTML (relative to project root)")
    parser.add_argument("--pause", action="store_true", help="wait for Enter before closing (useful when double-clicking)")
    args = parser.parse_args()

    input_path = (ROOT / args.input).resolve()
    output_path = (ROOT / args.output).resolve()
    if input_path != ROOT and ROOT not in input_path.parents:
        raise ValueError(f"Input path must stay inside project: {args.input}")
    if output_path != ROOT and ROOT not in output_path.parents:
        raise ValueError(f"Output path must stay inside project: {args.output}")
    html = input_path.read_text(encoding="utf-8")
    local_count = sum(module_path(match.group('src')) is not None for match in LOCAL_SCRIPT.finditer(html))
    standalone, _ = LOCAL_SCRIPT.subn(inline_module, html)
    if local_count == 0:
        raise RuntimeError("No local *.js script tags were found; refusing to create an empty build.")

    output_path.write_text(standalone, encoding="utf-8", newline="\n")
    print(f"Created {output_path.name}: {local_count} local modules inlined.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"BUILD FAILED: {exc}", file=sys.stderr)
        if "--pause" in sys.argv:
            input("Press Enter to close...")
        raise SystemExit(1)
