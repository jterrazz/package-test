#!/bin/bash
set -e

# Tiny CLI fixture for the docker() spec mode.
#
# Reads FAKE_TEST_LABEL from the env (the runner injects a per-test id) and
# spawns a detached busybox container that:
#   - is labelled with fake.test.run=<FAKE_TEST_LABEL>   (test-run scoping)
#   - is labelled with fake.world.name=<name>            (looked up by tests)
#   - writes a marker file at /workspace/out.txt so file() reads can be exercised
#   - stays alive until the test disposes it

COMMAND="${1:-help}"

case "$COMMAND" in
    spawn)
        NAME="${2:-default}"
        if [ -z "${FAKE_TEST_LABEL:-}" ]; then
            echo "FAKE_TEST_LABEL is required" >&2
            exit 2
        fi

        docker run -d \
            --label "fake.test.run=${FAKE_TEST_LABEL}" \
            --label "fake.world.name=${NAME}" \
            --name "jtt-docker-cli-${FAKE_TEST_LABEL}-${NAME}" \
            --entrypoint sh \
            busybox:latest \
            -c "mkdir -p /workspace && echo hello-from-${NAME} > /workspace/out.txt && sleep 3600" \
            > /dev/null

        echo "spawned ${NAME}"
        ;;
    help|*)
        echo "Usage: docker-cli spawn <name>"
        ;;
esac
