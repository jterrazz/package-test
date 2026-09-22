#!/bin/bash
# The report a lint rule's `<case>.spec.yaml` reads: `report.sh [args]` runs
# the real oxlint with this package's plugin (lint.sh), `report.sh checker
# [args]` runs the conventions checker (check.sh). One binary, so one runner
# serves every rule document, whichever channel the rule lives in.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$1" = "checker" ]; then
  shift
  exec bash "$SCRIPT_DIR/../checker-cli/check.sh" "$@"
fi
exec bash "$SCRIPT_DIR/lint.sh" "$@"
