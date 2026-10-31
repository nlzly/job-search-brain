#!/usr/bin/env python3
"""Compatibility entry point; uses the same private preferences as the web app."""
from pathlib import Path
import subprocess
import sys

if __name__ == "__main__":
    raise SystemExit(subprocess.call(["node", str(Path(__file__).resolve().parent / "scan.js"), *sys.argv[1:]]))
