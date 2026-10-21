# ADR-020: The docker program is spawned beside the containers

**Status:** Accepted
**Date:** 2026-10-21

Supersedes the `docker` bullet of [ADR-009](009-node-builtins-are-not-libraries.md); the rest of ADR-009 stands.

## Context

ADR-009 kept the module that runs `docker` in `expectations/command/`, because `world/services/` is where `testcontainers` lives and `expectations/` could not reach it without an edge the layer map forbade. The cost showed once the module was read whole: the daemon was checked twice, once by that module (`specification.cli({ docker })`) and once through testcontainers' client in `services/containers/`, with two wordings for the same absent daemon.

## Decision

- The one module that spawns `docker` is `services/containers/docker-cli.ts`: its lookup, its daemon check and its container reads, one module with one timeout, beside the containers the test declares.
- The layer map grants the two results that read a subject's containers, `expectations/command/cli.result.ts` and `container.ts`, the single edge to that module; no other `expectations/` file reaches `services/`.
- Both refusals name the absent daemon in one wording, `DOCKER_ABSENT`. The two probes stay two: the cli check runs `docker version`, since a docker-aware cli project need not install the testcontainers peer the services' client comes from.

## Consequences

- `docker` still has exactly one spawning module; `SPAWNING_SITES` in `lint/self/checks/architecture.ts` lists it at its new path.
- `expectations/` is no longer a layer that imports only the kernel: two named edges are the price, each declared with its reason in `lint/self/checks/layers.ts`.
