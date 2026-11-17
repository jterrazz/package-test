# ADR-023: The component pages run before any container starts

**Status:** Accepted
**Date:** 2026-11-17

Supersedes the one group for every parallel project of [ADR-019](019-every-project-runs-in-one-group-and-a-serial-one-after-it.md); its serial group after the parallel ones, and its one place a group is set, stand.

## Context

The whole suite failed intermittently on component files, on `TypeError: Failed to fetch dynamically imported module: http://localhost:<port>/node_modules/msw/lib/browser/index.js?v=…`. The page's lazy `import('msw/browser')` fetches dozens of modules, so it is the usual victim, not the cause.

Chromium aborts every request in flight with `ERR_NETWORK_CHANGED` when the host's IP addresses change. A container that starts or stops changes them: its host-side veth gains or loses an `inet6 fe80::` address, and about a second later Chromium's `NETWORK_IP_ADDRESSES_CHANGED` fires and the page's module fetches die. A Chromium netlog of a failing run held 390 such aborts, each right after an address-change event, each of those right after a `docker events` network connect. The component project alone failed 0 times in 15 runs; with containers starting and stopping beside it, 3 times in 5. Vite re-optimising its dependencies was ruled out (its traces were clean), and so was the browser's port.

Under ADR-019 the component pages ran in group 0 beside `api`, `job`, `integration` and `cli`, whose services and Docker option start the run's containers. On the development VM, 4 whole gates in about 8 failed on it, and 4 `make test` runs in 6 measured before this change.

The decision was delegated by the owner on 2026-11-17: "ok go fix direct toi tkt allez, pas besoin de pr".

## Decision

- The kinds that start no container, `unit`, `lint` and `component`, run in the first groups; the kinds that may start one run after them. `api`, `job` and `integration` hold the services setup; `cli` starts containers through its `docker` option; `website` and `mobile` start whatever services their spec declares, a container among them, outside the run's services setup.
- On each side a serial project runs after the parallel ones: group 0 the parallel kinds that start no container, 1 their serial ones, 2 the parallel kinds that may start one, 3 their serial ones. Vitest runs one group after another, and refuses one group whose projects resolve two worker counts.
- The component pages go first, not last. First, no test of the run has asked for a container yet. Last, the pages would rely on every start and stop of the groups before them having settled: Chromium's event fires about a second after the address changes, and a container a test removes on its way out may still be losing its veth when its group ends.
- `projectTest` in `src/vitest/project.ts` stays the one place a group is set, and `index.vitest.test.ts` derives a tree of every kind and holds each to its group.

Rejected:

- A retry, of the import, the page or the test: it hides the abort, and the preset's `retry: 0` refuses it on principle.
- Pre-bundling msw so the page fetches fewer modules: it only narrows the window, and `@vitest/browser` already excludes `msw` and `msw/browser` from the optimizer, where an entry both included and excluded is fatal.
- A setting of the host (no IPv6 link-local address on the bridge's veths): it is not the package's to make, and every consumer's machine would owe it.

## Consequences

- A run's length grows by the time the component group and the container groups no longer overlap: `make test` on this repository, on the development VM under the exclusive lock, took 25.5, 25.5 and 25.7 s before (a first batch, run straight after a build, took 25.5, 28.0 and 29.4 s) and between 28.3 and 29.5 s after, median 28.5 s over ten runs: about 3 s, or 12 %. None of the ten failed on a page's fetch.
- A consumer changes nothing: no option, no config; only the order its projects run in, and its run's length.
- The exposure that remains is the machine's: a container started or stopped on the same host by anything else (another vitest run, another session, a compose stack) still changes the addresses under the pages, and a gate run beside one can still fail this way. The services setup's sweep of an earlier run's orphan containers also starts in the background before group 0, so a run that follows a killed one can meet it.
- The `website` pages, in Playwright's Chromium, run beside the containers of group 2 and stay exposed to the same abort; moving them would need a `website` project that declares no container service, which the package cannot tell from its kind.
