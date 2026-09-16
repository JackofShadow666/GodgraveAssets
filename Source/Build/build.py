"""Build a portable Godgrave HTML file from the modular source tree.

Every local JavaScript file linked by a ``<script src="...">`` tag in the
entry HTML is inlined, in the same order.  To add a new module, add its script
tag to Build.html; no changes to this builder are required.

Usage:
    python build.py
    python build.py --gui
    python build.py --cli
    python build.py --input Build.html --output Build.standalone.html
    python build.py --pause
"""

from __future__ import annotations

import argparse
import logging
import re
import threading
import traceback
from pathlib import Path
from queue import Empty, Queue


ROOT = Path(__file__).resolve().parent
LOG_PATH = ROOT / "build.log"
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


def make_logger(verbose: bool = False) -> logging.Logger:
    logger = logging.getLogger("godgrave-build")
    logger.setLevel(logging.DEBUG)
    logger.handlers.clear()
    logger.propagate = False

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S")
    file_handler = logging.FileHandler(LOG_PATH, mode="w", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(logging.DEBUG if verbose else logging.INFO)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)
    return logger


def inline_module(match: re.Match[str], logger: logging.Logger) -> str:
    relative_path = match.group('src')
    path = module_path(relative_path)
    if path is None:
        logger.info("Skipping external script: %s", relative_path)
        return match.group(0)
    if not path.is_file():
        raise FileNotFoundError(f"Module referenced by Build.html is missing: {relative_path}")

    logger.info("Inlining %s", relative_path)
    try:
        source = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise UnicodeDecodeError(
            exc.encoding,
            exc.object,
            exc.start,
            exc.end,
            f"{exc.reason} while reading {relative_path}; save this file as UTF-8",
        ) from exc
    return f'<script>\n// === bundled: {relative_path} ===\n{source}\n</script>'


def build(input_name: str, output_name: str, logger: logging.Logger) -> int:
    logger.info("Project root: %s", ROOT)
    logger.info("Reading %s", input_name)
    input_path = (ROOT / input_name).resolve()
    output_path = (ROOT / output_name).resolve()
    if input_path != ROOT and ROOT not in input_path.parents:
        raise ValueError(f"Input path must stay inside project: {input_name}")
    if output_path != ROOT and ROOT not in output_path.parents:
        raise ValueError(f"Output path must stay inside project: {output_name}")

    if not input_path.is_file():
        raise FileNotFoundError(f"Input HTML was not found: {input_name}")

    html = input_path.read_text(encoding="utf-8")
    local_count = sum(module_path(match.group('src')) is not None for match in LOCAL_SCRIPT.finditer(html))
    logger.info("Found %s local module(s)", local_count)
    standalone = LOCAL_SCRIPT.sub(lambda match: inline_module(match, logger), html)
    if local_count == 0:
        raise RuntimeError("No local *.js script tags were found; refusing to create an empty build.")

    logger.info("Writing %s", output_name)
    output_path.write_text(standalone, encoding="utf-8", newline="\n")
    logger.info("Created %s: %s local modules inlined.", output_path.name, local_count)
    return local_count


def run_gui(args: argparse.Namespace) -> int:
    from tkinter import BOTH, DISABLED, END, LEFT, NORMAL, RIGHT, Tk, messagebox
    from tkinter import ttk
    from tkinter.scrolledtext import ScrolledText

    root = Tk()
    root.title("Godgrave Build")
    root.geometry("820x560")
    root.minsize(640, 420)

    frame = ttk.Frame(root, padding=12)
    frame.pack(fill=BOTH, expand=True)

    status = ttk.Label(frame, text="Ready")
    status.pack(fill="x")

    log_box = ScrolledText(frame, wrap="word", state=DISABLED, font=("Consolas", 10))
    log_box.pack(fill=BOTH, expand=True, pady=(8, 8))

    buttons = ttk.Frame(frame)
    buttons.pack(fill="x")

    queue: Queue[tuple[str, str]] = Queue()
    last_log = {"text": ""}
    last_error = {"text": ""}

    class QueueHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            queue.put(("log", self.format(record)))

    def append_line(line: str) -> None:
        last_log["text"] += line + "\n"
        log_box.configure(state=NORMAL)
        log_box.insert(END, line + "\n")
        log_box.see(END)
        log_box.configure(state=DISABLED)

    def set_running(running: bool) -> None:
        build_button.configure(state=DISABLED if running else NORMAL)
        status.configure(text="Building..." if running else "Ready")

    def copy_log() -> None:
        root.clipboard_clear()
        root.clipboard_append(last_log["text"])
        status.configure(text="Log copied to clipboard")

    def copy_error() -> None:
        root.clipboard_clear()
        root.clipboard_append(last_error["text"] or last_log["text"])
        status.configure(text="Error copied to clipboard")

    def open_log_file() -> None:
        messagebox.showinfo("Build log", f"Log file:\n{LOG_PATH}")

    def worker() -> None:
        logger = make_logger(verbose=True)
        gui_handler = QueueHandler()
        gui_handler.setLevel(logging.DEBUG)
        gui_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
        logger.addHandler(gui_handler)
        try:
            count = build(args.input, args.output, logger)
        except Exception:
            details = traceback.format_exc()
            last_error["text"] = details
            logger.error("BUILD FAILED\n%s", details)
            queue.put(("failed", "Build failed. Error copied easily from the log window."))
        else:
            queue.put(("done", f"Build complete: {count} local modules inlined."))

    def start_build() -> None:
        last_log["text"] = ""
        last_error["text"] = ""
        log_box.configure(state=NORMAL)
        log_box.delete("1.0", END)
        log_box.configure(state=DISABLED)
        set_running(True)
        threading.Thread(target=worker, daemon=True).start()

    def poll() -> None:
        try:
            while True:
                kind, text = queue.get_nowait()
                if kind == "log":
                    append_line(text)
                elif kind == "done":
                    append_line(text)
                    status.configure(text=text)
                    set_running(False)
                elif kind == "failed":
                    append_line(text)
                    status.configure(text="Build failed")
                    set_running(False)
        except Empty:
            pass
        root.after(100, poll)

    build_button = ttk.Button(buttons, text="Build", command=start_build)
    build_button.pack(side=LEFT)
    ttk.Button(buttons, text="Copy log", command=copy_log).pack(side=LEFT, padx=(8, 0))
    ttk.Button(buttons, text="Copy error", command=copy_error).pack(side=LEFT, padx=(8, 0))
    ttk.Button(buttons, text="Show log path", command=open_log_file).pack(side=LEFT, padx=(8, 0))
    ttk.Button(buttons, text="Close", command=root.destroy).pack(side=RIGHT)

    root.after(100, poll)
    root.after(250, start_build)
    root.mainloop()
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inline local Godgrave modules into one HTML file.")
    parser.add_argument("--input", default="Build.html", help="modular entry HTML (relative to project root)")
    parser.add_argument("--output", default="Build.standalone.html", help="portable output HTML (relative to project root)")
    parser.add_argument("--pause", action="store_true", help="wait for Enter before closing (useful when double-clicking)")
    parser.add_argument("--gui", action="store_true", help="show a build window with copyable logs")
    parser.add_argument("--cli", action="store_true", help="run in console mode instead of opening the build window")
    parser.add_argument("--verbose", action="store_true", help="print detailed logs and traceback in console mode")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.gui or not args.cli:
        return run_gui(args)

    logger = make_logger(verbose=args.verbose)
    try:
        count = build(args.input, args.output, logger)
    except Exception as exc:
        logger.error("BUILD FAILED: %s", exc)
        if args.verbose:
            logger.error("%s", traceback.format_exc())
        if args.pause:
            input("Press Enter to close...")
        return 1

    print(f"Created {args.output}: {count} local modules inlined. Log: {LOG_PATH.name}")
    if args.pause:
        input("Press Enter to close...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
