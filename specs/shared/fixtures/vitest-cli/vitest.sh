#!/bin/sh
# This checkout's vitest, run over the scratch project the spec laid in the
# working directory: its dependencies are this checkout's, its entry is
# handed as IN_PLACE_ENTRY so a scratch test imports the framework's source,
# and the preset's update-mode setup as IN_PLACE_SETUP for a scratch config.
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
[ -e node_modules ] || ln -s "$root/node_modules" node_modules
IN_PLACE_ENTRY="$root/src/index.ts"
IN_PLACE_SETUP="$root/src/runner/in-place-setup.ts"
export IN_PLACE_ENTRY IN_PLACE_SETUP
exec node "$root/node_modules/vitest/vitest.mjs" "$@"
