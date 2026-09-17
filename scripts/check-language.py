#!/usr/bin/env python3
"""Language checker: finds Portuguese (or other non-English) text in the codebase
and config files using Lovable AI Gateway, with suggested English replacements.

Usage:
  python scripts/check-language.py [--output report.md]
"""

import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, "/tmp")
from lovable_ai import call_ai_structured  # noqa: E402

MODEL = "openai/gpt-6-astra"
EXTS = (".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md", ".html", ".txt")
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".output", ".vinxi", ".lovable"}
SKIP_FILES = {"src/routeTree.gen.ts", "bun.lock", "package-lock.json"}
MAX_CHARS = 60000

SCHEMA = {
    "name": "report_findings",
    "description": "Report non-English (especially Portuguese) text found in the files.",
    "parameters": {
        "type": "object",
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "line": {"type": "integer"},
                        "text": {"type": "string"},
                        "language": {"type": "string"},
                        "suggestion": {"type": "string"},
                    },
                    "required": ["file", "line", "text", "language", "suggestion"],
                },
            }
        },
        "required": ["findings"],
    },
}

SYSTEM = (
    "You are a strict localization reviewer. You receive source and config files with "
    "numbered lines. Report every string, comment, identifier or config value written in "
    "Portuguese, Spanish or any language other than English. Ignore code keywords, library "
    "names, URLs, emoji, hex/oklch values and English text. For each finding give the exact "
    "file, line number, the offending text and a natural English replacement. If everything "
    "is English, return an empty findings list."
)


def collect_files(root: str):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            if not fn.endswith(EXTS):
                continue
            path = os.path.relpath(os.path.join(dirpath, fn), root)
            if path in SKIP_FILES:
                continue
            out.append(path)
    return sorted(out)


def build_chunks(root: str, files):
    chunks, current, size = [], [], 0
    for path in files:
        try:
            with open(os.path.join(root, path), encoding="utf-8") as fh:
                lines = fh.read().splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        body = "\n".join(f"{i + 1}: {line}" for i, line in enumerate(lines))
        block = f"\n===== FILE: {path} =====\n{body}\n"
        if size + len(block) > MAX_CHARS and current:
            chunks.append("".join(current))
            current, size = [], 0
        current.append(block)
        size += len(block)
    if current:
        chunks.append("".join(current))
    return chunks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", help="Write a markdown report to this path")
    parser.add_argument("--json", dest="as_json", action="store_true")
    args = parser.parse_args()

    root = os.getcwd()
    files = collect_files(root)
    chunks = build_chunks(root, files)
    findings = []
    for idx, chunk in enumerate(chunks, 1):
        print(f"Scanning chunk {idx}/{len(chunks)}...", file=sys.stderr)
        result = call_ai_structured(
            chunk,
            SCHEMA["name"],
            SCHEMA["description"],
            SCHEMA["parameters"],
            system=SYSTEM,
            model=MODEL,
        )
        findings.extend(result.get("findings", []))

    if args.as_json:
        print(json.dumps({"findings": findings}, indent=2, ensure_ascii=False))
        return

    lines = [f"# Language check ({len(files)} files scanned)", ""]
    if not findings:
        lines.append("No Portuguese or other non-English text found. Everything is in English.")
    else:
        lines.append(f"Found {len(findings)} item(s) to translate:")
        lines.append("")
        for f in findings:
            lines.append(f"- `{f['file']}:{f['line']}` ({f['language']})")
            lines.append(f"  - found: {f['text']}")
            lines.append(f"  - english: {f['suggestion']}")
    report = "\n".join(lines)
    print(report)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(report + "\n")


if __name__ == "__main__":
    main()
