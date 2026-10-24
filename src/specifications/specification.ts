import { startApi } from './api/api.handle.js';
import { startCli } from './cli/cli.handle.js';
import { startDeployment } from './deployment/deployment.handle.js';
import { startIntegration } from './integration/integration.handle.js';
import { startJob } from './job/job.handle.js';
import { startLint } from './lint/lint.handle.js';
import { startMobile } from './mobile/mobile.handle.js';
import { startWebsite } from './website/website.handle.js';

/** The eight constructors, and only eight: the framework's whole entry surface. */
export type Specification = {
    api: typeof startApi;
    cli: typeof startCli;
    deployment: typeof startDeployment;
    integration: typeof startIntegration;
    job: typeof startJob;
    lint: typeof startLint;
    mobile: typeof startMobile;
    website: typeof startWebsite;
};

/** Created in a `*.specification.ts` under `specs/`, destructured with canonical names, cleaned up via `afterAll(cleanup)` (`runner-in-specification-file`, `no-runner-alias`, `cleanup-passed-to-after-all`). */
export const specification: Specification = {
    /** Test an HTTP app: services via testcontainers, the app in this process. */
    api: startApi,
    /** Test a command binary, each spec in a fresh temp directory. */
    cli: startCli,
    /** Probe a running deployment over the network: one complete HTTP exchange, no browser; `.get(url)` or `.request(...)` ends the chain. */
    deployment: startDeployment,
    /** Specify a module against real services, or against a golden; `.call()` ends the chain. */
    integration: startIntegration,
    /** Test background jobs, in this process; `.trigger(name)` ends the chain. */
    job: startJob,
    /** Test the rules a project ships: a fixture tree, linted by the real oxlint, checkers and presets; `.run()` ends the chain. */
    lint: startLint,
    /** Test a native app on the iOS simulator; `.open(deepLink?, scenario?)` ends the chain. */
    mobile: startMobile,
    /** Test a served or deployed website: `.visit(path)` renders it, `.fetch(path)` is one raw exchange. */
    website: startWebsite,
};
