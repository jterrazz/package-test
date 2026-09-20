#!/bin/bash
# E2E lint wrapper: runs the real oxlint binary with the @jterrazz/test plugin
# active (loaded from the built bundle dist/oxlint.js) against the working dir.
# specs/lint/** dogfoods the lint layer through specification.cli by pointing
# the runner at this script. Requires `npm run build` first (the plugin loads
# from dist/, since Node type-stripping cannot load the .ts source directly).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# npm hoists oxlint to the repository's own .bin when nothing else claims it,
# And nests it under the toolchain that depends on it when something does.
# Both layouts are ordinary installs, so the wrapper looks in both rather than
# Silently linting NOTHING when the resolution moves.
OXLINT="$REPO_ROOT/node_modules/.bin/oxlint"
if [ ! -x "$OXLINT" ]; then
  OXLINT="$REPO_ROOT/node_modules/@jterrazz/typescript/node_modules/.bin/oxlint"
fi
if [ ! -x "$OXLINT" ]; then
  echo "lint.sh: no oxlint binary under $REPO_ROOT/node_modules — run npm install" >&2
  exit 2
fi
# The reach fixture (K4) declares a `depth` of its own, so the config is
# Chosen by the caller; every other run takes the standard one.
CONFIG="$SCRIPT_DIR/${LINT_CONFIG:-oxlint.e2e.json}"
TARGET="${1:-.}"

# exec so oxlint's exit code (1 on violations, 0 when clean) is the script's.
exec "$OXLINT" --config "$CONFIG" "$TARGET"
