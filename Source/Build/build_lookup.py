from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BUILD_SCRIPT = ROOT / "build.py"
STANDALONE_HTML = ROOT / "Build.standalone.html"
NOTEPADPP = Path(r"C:\Program Files\Notepad++\notepad++.exe")
MODULE_MARKER = re.compile(r"// === bundled: (?P<path>.+?) ===")


def run_build() -> None:
    result = subprocess.run(
        [sys.executable, str(BUILD_SCRIPT)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if result.stdout:
        print(result.stdout.rstrip())
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr.rstrip(), file=sys.stderr)
        raise SystemExit(result.returncode)


def read_clipboard() -> str:
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Failed to read clipboard")
    return result.stdout


def normalize_text(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip("\n")


def line_number_for_offset(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def module_for_line(lines: list[str], line_number: int) -> tuple[str | None, int | None]:
    source_path = None
    source_start_line = None
    for index, line in enumerate(lines, start=1):
        match = MODULE_MARKER.search(line)
        if match:
            source_path = match.group("path")
            source_start_line = index + 1
        if index >= line_number:
            break
    return source_path, source_start_line


def find_matches(bundle_text: str, query: str) -> list[dict[str, int | str | None]]:
    lines = bundle_text.splitlines()
    matches: list[dict[str, int | str | None]] = []
    start = 0
    while True:
        offset = bundle_text.find(query, start)
        if offset == -1:
            return matches
        bundle_line = line_number_for_offset(bundle_text, offset)
        source_path, source_start_line = module_for_line(lines, bundle_line)
        source_line = None
        if source_start_line is not None:
            source_line = bundle_line - source_start_line + 1
        matches.append(
            {
                "bundle_line": bundle_line,
                "source_path": source_path,
                "source_line": source_line,
            }
        )
        start = offset + 1


def open_in_notepadpp(path: Path, line_number: int | None) -> None:
    if not NOTEPADPP.is_file():
        raise RuntimeError(f"Notepad++ not found: {NOTEPADPP}")
    cmd = [str(NOTEPADPP)]
    if line_number and line_number > 0:
        cmd.append(f"-n{line_number}")
    cmd.append(str(path))
    subprocess.Popen(cmd, cwd=ROOT)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build standalone HTML, find text inside it, and map the hit back to the source file."
    )
    parser.add_argument("--text", help="Search text. Defaults to clipboard contents.")
    parser.add_argument("--no-build", action="store_true", help="Skip rebuilding Build.standalone.html.")
    parser.add_argument("--all", action="store_true", help="Print every match instead of the first only.")
    parser.add_argument("--no-open", action="store_true", help="Do not open the first match in Notepad++.")
    args = parser.parse_args()

    if not args.no_build:
        run_build()

    if not STANDALONE_HTML.is_file():
        raise SystemExit(f"Missing standalone build: {STANDALONE_HTML}")

    raw_query = args.text if args.text is not None else read_clipboard()
    query = normalize_text(raw_query)
    if not query:
        raise SystemExit("Clipboard/search text is empty.")

    bundle_text = STANDALONE_HTML.read_text(encoding="utf-8")
    matches = find_matches(bundle_text, query)
    if not matches:
        raise SystemExit("No matches found in Build.standalone.html.")

    shown_matches = matches if args.all else matches[:1]
    for index, match in enumerate(shown_matches, start=1):
        source_path = match["source_path"] or "<unknown>"
        source_line = match["source_line"] or 0
        print(f"[{index}] bundle line {match['bundle_line']} -> {source_path}:{source_line}")

    first = matches[0]
    if not args.no_open and first["source_path"]:
        source_path = ROOT / str(first["source_path"])
        open_in_notepadpp(source_path, int(first["source_line"] or 1))
        print(f"Opened in Notepad++: {source_path}")


if __name__ == "__main__":
    main()
