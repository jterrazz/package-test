import type { ChainConfig } from '../../chain/config.js';
import { refusal } from '../../chain/refusals/refusal.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import type { ResponseRecording } from '../../expectations/http/response.js';
import type { DeploymentSpecification } from './deployment.composition.js';
import { deploymentDefinition } from './deployment.composition.js';

// invariant: long enough for a TLS handshake across the internet, short enough that a closed port never holds a suite.
const DEFAULT_TIMEOUT_MS = 5000;

const DEFAULT_RECORDED_HEADERS = ['content-type', 'location'] as const;

/** Options for {@link startDeployment | specification.deployment}. */
export type DeploymentSpecificationOptions = {
    /** A certificate authority trusted beside the ones node trusts: its PEM text, a value like any string. */
    ca?: string;
    /** Accept a certificate the trust check refuses (self-signed, expired, another host's); `result.tls` still says why. Default `false`. */
    insecure?: boolean;
    /** The headers update mode records into a golden that states none yet, those the response carries. Default `['content-type', 'location']`. */
    recordedHeaders?: readonly string[];
    /** The milliseconds one exchange may take, connection to last byte, before it reads `unreachable: timeout`. Default `5000`. */
    timeout?: number;
    /** The base URL a path is read from (`.get('/health')`); a URL written whole needs none. */
    url?: string;
};

export type DeploymentConfig = ChainConfig & {
    baseUrl: string | undefined;
    ca: string | undefined;
    insecure: boolean;
    recording: ResponseRecording;
    timeout: number;
};

/** What `specification.deployment()` returns: `const { deployment, cleanup } = ...` (`no-runner-alias`). */
export type DeploymentHandle = {
    /** Starts nothing, so releases nothing: passed to `afterAll` like every specification's. */
    cleanup: () => Promise<void>;
    deployment: DeploymentSpecification;
};

/** Refused before the first exchange: a base that is no http(s) URL, and a deadline that is no positive number of milliseconds. */
export function refuseOptions(options: DeploymentSpecificationOptions): void {
    if (options.url !== undefined && !/^https?:\/\/[^/\s]/u.test(options.url)) {
        throw new Error(
            refusal({
                fix: "name the deployment's base as an absolute URL, `url: 'https://site.test'`, or leave it out and write each URL whole",
                found: `specification.deployment({ url: ${JSON.stringify(options.url)} }), no http(s) URL`,
                read: 'docs/guides/deployment-specs.md#options',
                why: 'A path is read from the base `url`, so the base is an absolute http:// or https:// URL.',
            }),
        );
    }
    if (
        options.timeout !== undefined &&
        (!Number.isFinite(options.timeout) || options.timeout <= 0)
    ) {
        throw new Error(
            refusal({
                fix: 'pass the milliseconds one exchange may take, `timeout: 2000`, or leave the 5000 default',
                found: `specification.deployment({ timeout: ${String(options.timeout)} }), no deadline`,
                read: 'docs/guides/deployment-specs.md#options',
                why: 'An exchange that never answers reads `unreachable: timeout` once its deadline passes, so the deadline is a positive number of milliseconds.',
            }),
        );
    }
}

export async function startDeployment(
    options: DeploymentSpecificationOptions = {},
): Promise<DeploymentHandle> {
    await registerMatchers();
    refuseOptions(options);

    const config: DeploymentConfig = {
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
        cleanup: async () => {
            // invariant: an exchange holds its socket for its own length only, so nothing outlives a test.
        },
        deployment: deploymentDefinition.open(config),
    };
}
