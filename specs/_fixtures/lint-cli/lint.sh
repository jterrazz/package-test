#!/bin/bash
# E2E lint wrapper: runs the real oxlint binary with the @jterrazz/test plugin
# active (loaded from the built bundle dist/oxlint.js) against the working dir.
# specs/lint/** dogfoods the lint layer through specification.cli by pointing
# the runner at this script. Requires `npm run build` first (the plugin loads
# from dist/, since Node type-stripping cannot load the .ts source directly).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OXLINT="$REPO_ROOT/node_modules/.bin/oxlint"
CONFIG="$SCRIPT_DIR/oxlint.e2e.json"
TARGET="${1:-.}"

# exec so oxlint's exit code (1 on violations, 0 when clean) is the script's.
exec "$OXLINT" --config "$CONFIG" "$TARGET"
