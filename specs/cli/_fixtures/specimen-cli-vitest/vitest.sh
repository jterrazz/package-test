#!/bin/sh
# This checkout's vitest, run over the scratch project the spec laid in the
# working directory: its dependencies are this checkout's, and the framework
# is its build, as an install holds it (`npm run build` first) — the entry
# handed as IN_PLACE_ENTRY so a scratch test imports it, the preset's
# update-mode setup as IN_PLACE_SETUP for a scratch config, and the
# runner-config entry as RUNNER_ENTRY for a scratch config that builds its
# projects with the framework's helpers (read with `--configLoader runner`).
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
[ -e node_modules ] || ln -s "$root/node_modules" node_modules
IN_PLACE_ENTRY="$root/dist/index.js"
IN_PLACE_SETUP="$root/dist/in-place.global-setup.js"
RUNNER_ENTRY="$root/dist/vitest.js"
export IN_PLACE_ENTRY IN_PLACE_SETUP RUNNER_ENTRY
exec node "$root/node_modules/vitest/vitest.mjs" "$@"
