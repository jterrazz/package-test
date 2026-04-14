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
        ;;
    scaffold)
        mkdir -p out/src out/docs
        echo "package main" > out/main.go
        echo "module example" > out/go.mod
        echo "console.log('hi')" > out/src/index.txt
        echo "# Docs" > out/docs/README.md
        echo "Scaffolded"
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
    *)
        echo "Unknown command: $COMMAND" >&2
        exit 1
        ;;
esac
