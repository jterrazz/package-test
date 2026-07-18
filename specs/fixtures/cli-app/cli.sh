#!/bin/bash
set -e

COMMAND="${1:-help}"

case "$COMMAND" in
    build)
        echo "Build completed"
        mkdir -p dist
        echo "console.log('Hello from CLI app');" > dist/index.js
        echo '{"name":"cli-app"}' > dist/manifest.json
        ;;
    start)
        if [ ! -f "dist/index.js" ]; then
            echo "Error: dist/index.js not found. Run build first." >&2
            exit 1
        fi
        node dist/index.js
        ;;
    dev)
        echo "Starting dev mode..."
        mkdir -p dist
        echo "console.log('Hello from CLI app');" > dist/index.js
        echo "Build complete"
        node dist/index.js
        # Simulate watch mode — keep running
        while true; do
            sleep 1
        done
        ;;
    dev-stderr)
        # Readiness banner on stderr (many daemons log status there),
        # then keep running like watch mode.
        echo "Listening on stderr" >&2
        while true; do
            sleep 1
        done
        ;;
    spawn-daemon)
        # Spawn a looping background GRANDCHILD (like tsdown --watch under a
        # dev command), record its pid, then keep the direct child running:
        # termination must reach the whole process group, not just this shell.
        sh -c 'while :; do sleep 0.2; done' &
        echo "$!" > daemon.pid
        echo "daemon ready"
        while true; do
            sleep 1
        done
        ;;
    check)
        echo "Checking..."
        if [ -f "invalid.ts" ]; then
            echo "Error: unused-var in invalid.ts" >&2
            exit 1
        fi
        echo "All checks passed"
        ;;
    fail)
        echo "Starting..." >&2
        echo "Fatal: something went wrong" >&2
        exit 2
        ;;
    env)
        echo "MY_VAR=${MY_VAR:-unset}"
        echo "HOME=${HOME:-unset}"
        echo "EXTRA=${EXTRA:-unset}"
        echo "DB_URL=${DB_URL:-unset}"
        echo "DATABASE_URL=${DATABASE_URL:-unset}"
        echo "REDIS_URL=${REDIS_URL:-unset}"
        ;;
    version)
        echo "cli-app v1.2.3"
        echo "run 7f9c2ba4-33ab-4d5e-9c1d-2a6b7c8d9e0f started at 2026-07-17T10:00:00.000Z"
        echo "cwd $PWD"
        echo "done in 12ms"
        ;;
    scaffold)
        mkdir -p out/src out/docs
        echo "package main" > out/main.go
        echo "module example" > out/go.mod
        echo "console.log('hi')" > out/src/index.txt
        echo "# Docs" > out/docs/README.md
        echo "Scaffolded"
        ;;
    scaffold-dynamic)
        # Scaffold whose output embeds a fresh uuid — exercises uuid
        # tokens inside tree-snapshot file contents.
        mkdir -p out
        RUN_ID="$(node -e 'console.log(require("crypto").randomUUID())')"
        printf 'run %s\nstatus ok\n' "$RUN_ID" > out/report.txt
        echo "Scaffolded dynamic"
        ;;
    scaffold-changed)
        mkdir -p out/src out/docs
        echo "package main" > out/main.go
        echo "module CHANGED" > out/go.mod
        echo "console.log('hi')" > out/src/index.txt
        echo "# Docs" > out/docs/README.md
        echo "Scaffolded"
        ;;
    scaffold-extra)
        mkdir -p out/src out/docs
        echo "package main" > out/main.go
        echo "module example" > out/go.mod
        echo "console.log('hi')" > out/src/index.txt
        echo "# Docs" > out/docs/README.md
        echo "extra" > out/UNEXPECTED.txt
        echo "Scaffolded"
        ;;
    json)
        echo '{"name":"cli-app","version":"1.0.0","features":["build","check"]}'
        ;;
    json-cwd)
        # JSON whose values embed the run cwd — exercises workdir-token
        # substitution on the JSON update path (the cwd is the only value that
        # Differs across runs, so a substituted golden must match the next run).
        printf '{"cwd":"%s","log":"wrote %s/out.txt","name":"cli-app"}\n' "$PWD" "$PWD"
        ;;
    ansi)
        printf '\x1b[31mred\x1b[0m plain \x1b[1mbold\x1b[0m\n'
        ;;
    ansi-json)
        printf '\x1b[32m{"status":"ok","value":42}\x1b[0m\n'
        ;;
    read-seed)
        if [ -f "spwn.yaml" ]; then
            cat spwn.yaml
        fi
        if [ -d "spwn/agents" ]; then
            echo "agents:"
            find spwn/agents -type f | sort | while read -r f; do
                echo "  $f"
            done
        fi
        ;;
    help)
        echo "Usage: cli <command>"
        echo ""
        echo "Commands:"
        echo "  build   Build the project"
        echo "  check   Check code quality"
        ;;
    status-on-stderr)
        # Simulates the Unix convention where status banners go to
        # stderr and exit code is zero. Used to verify the exec
        # adapter captures stderr regardless of exit code.
        echo "Operation succeeded" >&2
        exit 0
        ;;
    *)
        echo "Unknown command: $COMMAND" >&2
        exit 1
        ;;
esac
