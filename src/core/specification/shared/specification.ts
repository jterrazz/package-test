import { startApi } from '../api/start-api.js';
import { startCli } from '../cli/start-cli.js';
import { startJobs } from '../jobs/start-jobs.js';
import { startWebsite } from '../website/start-website.js';

/**
 * The three specification constructors (CONVENTIONS A2) — created in a
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
export const specification = {
    /**
     * Test an HTTP app. Mode `'node'` (default) starts the declared services
     * via testcontainers and runs the app in-process; mode `'compose'` runs
     * `docker compose up` on `docker/compose.test.yaml` and sends real HTTP
     * requests to the app service. Resolution: `options.mode` > `TEST_MODE`
     * env var > `'node'`. Only `.api()` has a mode.
     */
    api: startApi,
    /**
     * Test a command binary. Each spec runs in a fresh temp directory.
     *
     * @param bin - Path to the binary (resolved from node_modules/.bin or PATH).
     */
    cli: startCli,
    /**
     * Test background jobs. Jobs run in-process by definition — no HTTP
     * server, no mode. `.trigger(name)` is the terminal action.
     */
    jobs: startJobs,
    /**
     * Test a deployed or locally-served website. `server` starts the site
     * (a shell command receiving `PORT`); `url` targets a running one.
     * `.visit(path)` renders the page in a single shared browser instance;
     * `.fetch(path)` performs one raw HTTP exchange (redirects never
     * followed).
     */
    website: startWebsite,
};
