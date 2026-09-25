import type { BrowserPort } from '../../elements/browser.port.js';
import type { ServerPort } from '../../facets/api/server/server.port.js';
import type { CliEnv, CliPort } from '../../facets/cli/process/cli.port.js';
import type { DevicePort } from '../../facets/mobile/device/device.port.js';
import type { DatabasePort } from '../../world/services/database.port.js';
import type { ServiceHandle } from '../../world/services/service.port.js';
import type { StubBackend } from '../../world/stubs/backend/stub-backend.js';

/**
 * A server a document may start by name (`serve: mcp`), registered once per app
 * in the `serve` option of `specification.cli()`.
 */
export type LiterateServeRegistration = {
    /** Shell command that starts the server, run from the project root. */
    command: string;
    /** The variable the resolved URL is bound to in every run's child env. */
    env: string;
    /**
     * Matched against the server's output; the FIRST capture group is the port
     * it chose — named (`(?<port>\d+)`) or not, it is group 1 either way.
     */
    ready: RegExp;
    /** Builds the URL bound to `env` from the announced port. */
    url: (port: number) => string;
};

/** A named job that can be triggered via job.trigger(). */
export type Job = {
    name: string;
    execute: () => Promise<void>;
};

/**
 * Configuration for the docker-aware cli mode. When set on
 * {@link SpecificationConfig}, the cli runner generates a test-run id, injects
 * it into the child env under `envVar`, then queries Docker for every
 * container carrying `testRunLabel=<id>` after the command exits.
 */
export type DockerSpecConfig = {
    envVar: string;
    nameLabel: string;
    testRunLabel: string;
};

/** Adapter configuration passed to the specification facets at setup time. */
export type SpecificationConfig = {
    /**
     * The declared stub backend (website/mobile facets) — armed with the
     * chain's stubs before every terminal action.
     */
    backend?: StubBackend | undefined;
    /**
     * Base URL of the running stub backend — allow-listed through the
     * browser's `external: 'block'` policy so client-side fetches reach it.
     */
    backendUrl?: string | undefined;
    /** Base URL of the website under test (website facet only). */
    baseUrl?: string | undefined;
    /**
     * Lazy browser accessor (website facet only). The first `.visit()`
     * launches the shared browser instance; `.fetch()`-only spec files never
     * pay the browser cost.
     */
    browser?: (() => Promise<BrowserPort>) | undefined;
    /**
     * Cross-origin request policy for visits (website facet only): `'block'`
     * aborts requests leaving the site under test — the browser-side analog
     * of strict intercepts.
     */
    external?: 'allow' | 'block' | undefined;
    /** Bundle id of the app under test (mobile facet only) — the app `.open()` relaunches. */
    bundleId?: string | undefined;
    command?: CliPort | undefined;
    database?: DatabasePort | undefined;
    /**
     * Keys of the declared services record that are databases. Drives the
     * CONVENTIONS A7 rule: with 2+ databases the `database` option is
     * mandatory on `.seed()` / `.table()`; with exactly one it is forbidden.
     */
    databaseKeys?: string[] | undefined;
    databases?: Map<string, DatabasePort> | undefined;
    /**
     * Lazy device accessor (mobile facet only). The first `.open()` creates
     * the driver session, or attaches to the run's; the appium/webdriverio
     * integration stays a lazy import so the optional peer is only loaded
     * when a spec opens the app.
     */
    device?: (() => Promise<DevicePort>) | undefined;
    dockerConfig?: DockerSpecConfig | undefined;
    /**
     * Unique id shared by every spec from this runner instance.
     * Stable for the runner's lifetime so multi-step tests (spawn in
     * one run, inspect in another) see the same container scope. The
     * facet factories auto-populate this when `dockerConfig` is present.
     */
    dockerTestRunId?: string | undefined;
    /**
     * Environment applied to every run of the declared binary
     * (`specification.cli({ defaults })`) — under a chain's own `.env()` and
     * under a document's `env:`, both of which win.
     */
    defaultEnv?: CliEnv | undefined;
    /**
     * Named environment SETS a spec document may name by bare word
     * (`env: frozen`). Declared once per app in `specification.cli()`.
     */
    envSets?: Record<string, CliEnv> | undefined;
    jobs?: Job[] | undefined;
    /** The project root — the working directory a document's `serve:` command runs from. */
    root?: string | undefined;
    server?: ServerPort | undefined;
    /**
     * Named servers a spec document may start (`serve: [mcp]`). Declared once
     * per app in `specification.cli()`.
     */
    serveRegistry?: Record<string, LiterateServeRegistration> | undefined;
    /**
     * The declared services record. In cli mode, drives the automatic
     * connection-URL injection into the child env (CONVENTIONS B6):
     * `<KEY>_URL` per service, plus `DATABASE_URL` / `REDIS_URL` when
     * unambiguous.
     */
    services?: Record<string, ServiceHandle> | undefined;
    /**
     * Optional normaliser applied to command stdout/stderr before every
     * comparison, and read by `.text`; `.raw` keeps the capture.
     */
    transform?: ((text: string) => string) | undefined;
};

/**
 * A configuration whose constructor started the named engines — each of them
 * present, so a facet armed through them is handed them by type.
 */
export type StartedWith<Key extends keyof SpecificationConfig> = SpecificationConfig & {
    readonly [Started in Key]-?: NonNullable<SpecificationConfig[Started]>;
};
