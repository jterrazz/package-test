import type { RouteArguments } from '../capabilities/params/route.js';
import type { FacetParams } from '../model/chain/capability.js';
import type { DiskFile } from '../model/chain/spec-path.js';
import type { VisitScenario } from '../model/ports/browser.port.js';
import type { ExecOptions } from '../model/ports/cli.port.js';
import type { MobileScenario } from '../model/ports/device.port.js';
import type { CallResult } from '../results/call.result.js';
import type { CliResult } from '../results/cli.result.js';
import type { FetchResult } from '../results/fetch.result.js';
import type { HttpResult } from '../results/http.result.js';
import type { JobsResult } from '../results/jobs.result.js';
import type { PageResult } from '../results/page.result.js';
import type { RenderResult } from '../results/render.result.js';
import type { ScreenResult } from '../results/screen.result.js';
import type { ComponentScenario, RenderSubject } from './render/scenario.js';
import type { LiterateRunFlags } from './run/literate.js';

/**
 * Every terminal action's signature, by name — what a chain type picks its
 * actions from. `P` is the facet's parameters.
 */
export type ActionSignatures<P extends FacetParams> = {
    /**
     * Call the module and resolve with what it produced. The started services
     * record is handed in, so the subject is constructed with the real
     * connection strings rather than with a double.
     */
    call: <T>(subject: (services: P['services']) => Promise<T> | T) => Promise<CallResult<T>>;
    /** Send a DELETE request to a route — `(template, { params })` — and resolve with the result. */
    delete: <Path extends string>(
        path: Path,
        ...options: RouteArguments<Path>
    ) => Promise<HttpResult>;
    /**
     * Execute the command (or sequence of commands) and resolve with the
     * result. Called with no arguments (`cli.exec()`), the binary runs bare —
     * no CLI arguments. With `{ waitFor, timeout }`, the process is
     * long-running: it resolves when the pattern appears and is killed at the
     * timeout.
     */
    exec: (args?: string | string[], options?: ExecOptions) => Promise<CliResult>;
    /** Perform one raw HTTP GET — redirects surface as 3xx results, never followed. */
    fetch: (path: string) => Promise<FetchResult>;
    /** Send a GET request to a route — `(template, { params })` — and resolve with the result. */
    get: <Path extends string>(path: Path, ...options: RouteArguments<Path>) => Promise<HttpResult>;
    /**
     * Relaunch the app and resolve with the captured screen. With a deep
     * link, the app opens on it; with a scenario, the visitor interacts
     * first (the When) and the capture reflects the FINAL screen state.
     */
    open: (deepLink?: string, scenario?: MobileScenario) => Promise<ScreenResult>;
    /** Send a POST request — the body a value or a `file()` — and resolve with the result. */
    post: <Path extends string>(
        path: Path,
        body?: unknown,
        ...options: RouteArguments<Path>
    ) => Promise<HttpResult>;
    /** Send a PUT request — the body a value or a `file()` — and resolve with the result. */
    put: <Path extends string>(
        path: Path,
        body?: unknown,
        ...options: RouteArguments<Path>
    ) => Promise<HttpResult>;
    /** Mount the subject, run the scenario, and capture what the page shows. */
    render: (subject: RenderSubject, scenario?: ComponentScenario) => Promise<RenderResult>;
    /** Send a complete request: its `.http` text written in the test, or `file('./requests/<name>.http')`. */
    request: (source: DiskFile<'.http'> | string) => Promise<HttpResult>;
    /**
     * Run a `<case>.spec.yaml` document — its ground (fixtures, env sets,
     * servers) and every run, each asserted — and resolve with the LAST run's
     * result, so a `.test.ts` can add an assertion the document cannot express
     * (a directory golden, a grep). The document is named with `file()`, from
     * the test file beside it.
     */
    run: (document: DiskFile<'.spec.yaml'>, options?: LiterateRunFlags) => Promise<CliResult>;
    /** Execute the named job registered via the `jobs` option and resolve with the result. */
    trigger: (name: string) => Promise<JobsResult>;
    /**
     * Render the page in the shared browser and resolve with the captured
     * document. With a scenario, the visitor interacts first (the When) and
     * the capture reflects the FINAL page state.
     */
    visit: (path: string, scenario?: VisitScenario) => Promise<PageResult>;
};
