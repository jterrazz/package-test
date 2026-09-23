#!/bin/sh
# This checkout's vitest, run over the scratch project the spec laid in the
# working directory: its dependencies are this checkout's, and its entry is
# handed as IN_PLACE_ENTRY so a scratch test imports the framework's source.
root="$(cd "$(dirname "$0")/../../.." && pwd)"
[ -e node_modules ] || ln -s "$root/node_modules" node_modules
IN_PLACE_ENTRY="$root/src/index.ts"
export IN_PLACE_ENTRY
exec node "$root/node_modules/vitest/vitest.mjs" "$@"
