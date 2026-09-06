#!/bin/bash
# E2E wrapper for the conventions checker (the non-oxlint static channel, D4):
# runs the bundled dist/checker.js against the working directory. specs/lint/**
# dogfoods the checker through specification.cli by pointing the runner here.
# Requires `npm run build` first (dist/checker.js).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# Forward every argument, so a spec can exercise the fixer (`. --fix`) too.
exec node "$REPO_ROOT/dist/checker.js" "${@:-.}"
