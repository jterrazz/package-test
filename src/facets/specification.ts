import { startApi } from './api/api.handle.js';
import type { ApiConfig } from './api/api.handle.js';
import { startCli } from './cli/cli.handle.js';
import type { CliConfig } from './cli/cli.handle.js';
import { startIntegration } from './integration/integration.handle.js';
import { startJob } from './job/job.handle.js';
import type { JobConfig } from './job/job.handle.js';
import { startMobile } from './mobile/mobile.handle.js';
import type { MobileConfig } from './mobile/mobile.handle.js';
import { startWebsite } from './website/website.handle.js';
import type { WebsiteConfig } from './website/website.handle.js';

/** Every facet's configuration, as one. */
export type SpecificationConfig = ApiConfig & CliConfig & JobConfig & MobileConfig & WebsiteConfig;

/** Created in a `*.specification.ts` under `specs/`, destructured with canonical names, cleaned up via `afterAll(cleanup)` (A1/A3/A4). */
/** The six constructors, and only six — the framework's whole entry surface. */
export type Specification = {
    api: typeof startApi;
    cli: typeof startCli;
    integration: typeof startIntegration;
    job: typeof startJob;
    mobile: typeof startMobile;
    website: typeof startWebsite;
};

export const specification: Specification = {
    /** Test an HTTP app: services via testcontainers, the app in this process. */
    api: startApi,
    /** Test a command binary, each spec in a fresh temp directory. */
    cli: startCli,
    /** Specify a module against real services, or against a golden; `.call()` ends the chain. */
    integration: startIntegration,
    /** Test background jobs, in this process; `.trigger(name)` ends the chain. */
    job: startJob,
    /** Test a native app on the iOS simulator; `.open(deepLink?, scenario?)` ends the chain. */
    mobile: startMobile,
    /** Test a served or deployed website: `.visit(path)` renders it, `.fetch(path)` is one raw exchange. */
    website: startWebsite,
};
