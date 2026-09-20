import { startApi } from '../api/start-api.js';
import { startCli } from '../cli/start-cli.js';
import { startIntegration } from '../integration/start-integration.js';
import { startJobs } from '../jobs/start-jobs.js';
import { startMobile } from '../mobile/start-mobile.js';
import { startWebsite } from '../website/start-website.js';

/**
 * The six specification constructors (CONVENTIONS A2) — created in a
 * `*.specification.ts` file under `specs/`, destructured with canonical
 * names, and cleaned up via `afterAll(cleanup)` (A1/A3/A4).
 *
 * @example
 *   // specs/api/api.specification.ts
 *   export const { api, cleanup } = await specification.api({
 *       services: { db: postgres() },
 *       server: ({ db }) => createApp({ databaseUrl: db.connectionString }),
 *   });
 *   afterAll(cleanup);
 *
 *   // specs/jobs/jobs.specification.ts
 *   export const { jobs, cleanup } = await specification.jobs({
 *       services: { db: postgres() },
 *       jobs: ({ db }) => [nightlyReport(db)],
 *   });
 *   afterAll(cleanup);
 *
 *   // specs/setup/cli.specification.ts
 *   export const { cli, cleanup } = await specification.cli('my-cli');
 *   afterAll(cleanup);
 */
/** The six constructors, and only six — the framework's whole entry surface. */
export type Specification = {
    api: typeof startApi;
    cli: typeof startCli;
    integration: typeof startIntegration;
    jobs: typeof startJobs;
    mobile: typeof startMobile;
    website: typeof startWebsite;
};

export const specification: Specification = {
    /**
     * Test an HTTP app. The declared `services` are started via testcontainers
     * and the app `server` builds runs in-process, so an outgoing call passes
     * through this process and `.intercept()` can answer it. There is one
     * shape of world — the record key is the service's only name.
     */
    api: startApi,
    /**
     * Test a command binary. Each spec runs in a fresh temp directory.
     *
     * @param bin - Path to the binary (resolved from node_modules/.bin or PATH).
     */
    cli: startCli,
    /**
     * Specify a module against the real thing: a database, a cache, a
     * `process()` it talks to — or nothing at all, when its oracle is a
     * golden. `.call((services) => …)` is the terminal action, and what it
     * produced is read as `result.value` or, when it refused, `result.error`.
     */
    integration: startIntegration,
    /**
     * Test background jobs. Jobs run in-process by definition — no HTTP
     * server, no mode. `.trigger(name)` is the terminal action.
     */
    jobs: startJobs,
    /**
     * Test a native app on the iOS simulator. `device` names the simulator
     * (resolved and booted via `simctl`); `app` names the bundle under
     * test. `.open(deepLink?, scenario?)` relaunches the app fresh, runs
     * the scenario, and captures the final screen.
     */
    mobile: startMobile,
    /**
     * Test a deployed or locally-served website. `server` starts the site
     * (a shell command receiving `PORT`); `url` targets a running one.
     * `.visit(path)` renders the page in a single shared browser instance;
     * `.fetch(path)` performs one raw HTTP exchange (redirects never
     * followed).
     */
    website: startWebsite,
};
