import { resolveRoot } from '../../../lint/kit/project/resolve.js';
import type { ChainConfig, Started } from '../../chain/config.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { refusal } from '../../chain/refusals/refusal.js';
import { createDockerReader } from '../../expectations/command/cli.result.js';
import type { ContainerAccessor } from '../../expectations/command/container.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import type { ResponseRecording } from '../../expectations/http/response.js';
import { declaredDatabaseKeys, declaredServices } from '../../services/services.js';
import type { DatabaseKeys, ServiceRecord, ServicesConfig } from '../../services/services.js';
import { startServices } from '../../services/startup/start-services.js';
import type { ApiSpecification } from './api.composition.js';
import { apiDefinition } from './api.composition.js';
import type { ApiDeployedSpecification } from './deployed/deployed.composition.js';
import { apiDeployedDefinition } from './deployed/deployed.composition.js';
import { refusingInProcessSetups } from './deployed/refused-setups.js';
import { routesLedger, writeLedger } from './routes/ledger.js';
import { HonoAdapter } from './server/hono.adapter.js';
import type { HonoApp } from './server/hono.adapter.js';
import type { ServerPort } from './server/server.port.js';

export type ApiConfig = ServicesConfig & { server?: ServerPort | undefined };

/** The app built in this process, from the services the specification starts. */
export type ApiServedOptions<Services extends ServiceRecord = ServiceRecord> = {
    /** Project root override; by default the nearest `package.json` above the specification file (`no-redundant-root`). */
    root?: string;
    /** The app factory: receives the started services record, returns the Hono app. */
    server: (services: Services) => HonoApp;
    /** Named infrastructure record: the keys are the `database` vocabulary, and name the init-script folder. */
    services?: Services;
};

/** The api already deployed, met over the network at its URL. */
export type ApiDeployedOptions = {
    /** A certificate authority trusted beside the ones node trusts: its PEM text, a value like any string. */
    ca?: string;
    /** Accept a certificate the trust check refuses (self-signed, expired, another host's); `result.tls` still says why. Default `false`. */
    insecure?: boolean;
    /** The headers update mode records into a golden that states none yet, those the response carries. Default `['content-type', 'location']`. */
    recordedHeaders?: readonly string[];
    /** The milliseconds one request may take, connection to last byte, before it reads `unreachable: timeout`. Default `5000`. */
    timeout?: number;
    /** The deployed api's base URL: a path is read from it (`.get('/health')`), a URL written whole reaches any host. */
    url: string;
};

type Absent<Options> = { [Key in keyof Options]?: never };

/** Options for {@link startApi | specification.api}: `server` or `url`, exclusive by type. */
export type ApiSpecificationOptions<Services extends ServiceRecord = ServiceRecord> =
    | (Absent<ApiDeployedOptions> & ApiServedOptions<Services>)
    | (Absent<ApiServedOptions> & ApiDeployedOptions);

export type ApiDeployedConfig = ChainConfig & {
    baseUrl: string;
    ca: string | undefined;
    insecure: boolean;
    recording: ResponseRecording;
    timeout: number;
};

/** What `specification.api({ server })` returns: `const { api, cleanup, docker } = ...` (`no-runner-alias`). */
export type ApiHandle<DatabaseKey extends string = string> = {
    api: ApiSpecification<DatabaseKey>;
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    /** Read a running container by id. */
    docker: (containerId: string) => ContainerAccessor;
};

/** What `specification.api({ url })` returns: `const { api, cleanup } = ...`; it starts nothing, so `cleanup` releases nothing and there is no container to read. */
export type ApiDeployedHandle = {
    api: ApiDeployedSpecification;
    cleanup: () => Promise<void>;
};

// invariant: long enough for a TLS handshake across the internet, short enough that a closed port never holds a suite.
const DEFAULT_TIMEOUT_MS = 5000;

const DEFAULT_RECORDED_HEADERS = ['content-type', 'location'] as const;

const DEPLOYED_ONLY = ['ca', 'insecure', 'recordedHeaders', 'timeout'] as const;

function refused(found: string, why: string, fix: string): Error {
    return new Error(refusal({ fix, found, read: 'docs/guides/api-specs.md#options', why }));
}

// invariant: the types already hold every pair below; this covers untyped callers.
function refuseTarget(options: Readonly<Record<string, unknown>>): void {
    const hasServer = options.server !== undefined;
    if (hasServer && options.url !== undefined) {
        throw refused(
            'specification.api({ server, url }), an app built here beside a deployed one',
            '`server` and `url` are exclusive: a request goes to the app this process builds, or to the one deployed at the url.',
            'keep `server` to test the app in this process, or `url` to probe the deployed one',
        );
    }
    const deployedOnly = DEPLOYED_ONLY.filter((name) => options[name] !== undefined);
    if (hasServer && deployedOnly.length > 0) {
        throw refused(
            `specification.api({ server, ${deployedOnly.join(', ')} }), an option of a deployed api beside an app built here`,
            '`ca`, `insecure`, `recordedHeaders` and `timeout` shape requests sent over the network, which a `url` names; an app built in this process is answered without one.',
            'drop them, or name the deployed api with `url`',
        );
    }
    if (!hasServer && (options.services !== undefined || options.root !== undefined)) {
        throw refused(
            'specification.api({ url, services }), services beside a deployed url',
            'A deployed api is wired to its own services: services started here never reach it.',
            'drop `services` and `root`, or build the app with `server` to wire them',
        );
    }
}

function refuseUrl(url: unknown): void {
    if (typeof url !== 'string' || url.trim() === '') {
        throw refused(
            `specification.api({ url: ${JSON.stringify(url)} }), no app to specify`,
            'An api spec names the app it requests: a `server` it builds in this process, or a deployed `url`.',
            'build the app with `server`, or pass the absolute URL of the deployed api as `url`',
        );
    }
    if (!/^https?:\/\/[^/\s]/u.test(url)) {
        throw refused(
            `specification.api({ url: ${JSON.stringify(url)} }), no http(s) URL`,
            'A path is read from the base `url`, so the base is an absolute http:// or https:// URL.',
            "name the deployed api's base as an absolute URL, `url: 'https://site.test'`",
        );
    }
}

function refuseTimeout(timeout: unknown): void {
    if (
        timeout !== undefined &&
        (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0)
    ) {
        throw refused(
            `specification.api({ url, timeout: ${typeof timeout === 'number' ? String(timeout) : JSON.stringify(timeout)} }), no deadline`,
            'A request that never answers reads `unreachable: timeout` once its deadline passes, so the deadline is a positive number of milliseconds.',
            'pass the milliseconds one request may take, `timeout: 2000`, or leave the 5000 default',
        );
    }
}

/** Refused before anything starts: a target that is neither or both, and what a deployed target cannot carry. */
export function refuseOptions(options: Readonly<Record<string, unknown>>): void {
    refuseTarget(options);
    if (options.server === undefined) {
        refuseUrl(options.url);
        refuseTimeout(options.timeout);
    }
}

function openDeployed(options: ApiDeployedOptions): ApiDeployedHandle {
    const config: ApiDeployedConfig = {
        baseUrl: options.url,
        ca: options.ca,
        insecure: options.insecure ?? false,
        recording: {
            bodyKeptAbsent: true,
            headers: options.recordedHeaders ?? DEFAULT_RECORDED_HEADERS,
        },
        timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    };
    return {
        api: refusingInProcessSetups(apiDeployedDefinition.open(config)),
        cleanup: async () => {
            // invariant: a request holds its socket for its own length only, so nothing outlives a test.
        },
    };
}

export async function startApi(
    options: Absent<ApiServedOptions> & ApiDeployedOptions,
): Promise<ApiDeployedHandle>;
export async function startApi<Services extends ServiceRecord = ServiceRecord>(
    options: Absent<ApiDeployedOptions> & ApiServedOptions<Services>,
): Promise<ApiHandle<DatabaseKeys<Services>>>;
export async function startApi<Services extends ServiceRecord>(
    options: ApiSpecificationOptions<Services>,
): Promise<ApiDeployedHandle | ApiHandle<DatabaseKeys<Services>>> {
    const callerDir = getCallerDir();
    await registerMatchers();
    refuseOptions(options);
    if (options.server === undefined) {
        return openDeployed(options);
    }
    return await startServed(options, callerDir);
}

async function startServed<Services extends ServiceRecord>(
    options: ApiServedOptions<Services>,
    callerDir: string,
): Promise<ApiHandle<DatabaseKeys<Services>>> {
    const root = resolveRoot(options.root, callerDir);
    const services = declaredServices(options.services);
    const databaseKeys = declaredDatabaseKeys(services);

    const { database, databases, stop } = await startServices(services, root);
    const app = options.server(services);
    const server = new HonoAdapter(app);

    const config: Started<ApiConfig, 'server'> = {
        database,
        databaseKeys,
        databases,
        server,
    };

    return {
        api: apiDefinition.open(config),
        cleanup: async () => {
            const ledgers = await routesLedger();
            // Stryker disable ConditionalExpression,BlockStatement,ObjectLiteral: only an api project provides a routes ledger, and the api specs run under one
            if (ledgers !== undefined) {
                writeLedger(ledgers, {
                    declared: server.declared(),
                    reached: server.reached,
                });
            }
            // Stryker restore ConditionalExpression,BlockStatement,ObjectLiteral
            await stop();
        },
        docker: createDockerReader(callerDir),
    };
}
