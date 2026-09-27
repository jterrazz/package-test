#!/bin/bash
# The report a lint rule's `<case>.spec.yaml` reads: `report.sh [args]` runs
# the real oxlint with this package's plugin (lint.sh), `report.sh checker
# [args]` runs the conventions checker (check.sh), `report.sh self-checker
# [args]` the passes only this package runs (dist/self.js check), `report.sh
# toolchain [self]` the preset @jterrazz/typescript runs (toolchain.mjs). One
# binary, so one runner serves every rule document, whichever channel the
# rule lives in.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$1" = "checker" ]; then
  shift
  exec bash "$SCRIPT_DIR/../../../lint/_fixtures/checker-cli/check.sh" "$@"
fi
if [ "$1" = "toolchain" ]; then
  shift
  exec node "$SCRIPT_DIR/toolchain.mjs" "$SCRIPT_DIR/../../../.." "$@"
fi
if [ "$1" = "self-checker" ]; then
  shift
  exec node "$SCRIPT_DIR/../../../../dist/self.js" check "${@:-.}"
fi
exec bash "$SCRIPT_DIR/lint.sh" "$@"
