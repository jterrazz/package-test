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
