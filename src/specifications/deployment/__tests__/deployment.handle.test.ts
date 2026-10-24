import { describe, expect, test } from 'vitest';

import { refuseOptions } from '../deployment.handle.js';
import type { DeploymentSpecificationOptions } from '../deployment.handle.js';

function refusalOf(options: DeploymentSpecificationOptions): string {
    try {
        refuseOptions(options);
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

const noDeadline = (timeout: string): string =>
    [
        `found: specification.deployment({ timeout: ${timeout} }), no deadline`,
        'why: An exchange that never answers reads `unreachable: timeout` once its deadline passes, so the deadline is a positive number of milliseconds.',
        'fix: pass the milliseconds one exchange may take, `timeout: 2000`, or leave the 5000 default',
        'read: docs/guides/deployment-specs.md#options',
    ].join('\n');

const noUrl = (url: string): string =>
    [
        `found: specification.deployment({ url: ${JSON.stringify(url)} }), no http(s) URL`,
        'why: A path is read from the base `url`, so the base is an absolute http:// or https:// URL.',
        "fix: name the deployment's base as an absolute URL, `url: 'https://site.test'`, or leave it out and write each URL whole",
        'read: docs/guides/deployment-specs.md#options',
    ].join('\n');

describe('deployment.handle', () => {
    test('deployment.handle — the options of a deployment — no option, an http or https base and a positive deadline are accepted', () => {
        // Given - the options a specification may name

        // Then - none refused
        expect([
            refusalOf({}),
            refusalOf({ url: 'http://127.0.0.1:8080' }),
            refusalOf({ timeout: 1, url: 'https://site.test/app' }),
        ]).toStrictEqual(['', '', '']);
    });

    test('deployment.handle — the options of a deployment — a base that is no http(s) url, and a deadline that is no positive number, are refused', () => {
        // Given - a bare host, another scheme, an empty base, and deadlines no exchange can meet
        // Then - each refusal whole
        expect([
            refusalOf({ url: 'site.test' }),
            refusalOf({ url: 'ftp://site.test' }),
            refusalOf({ url: 'https://' }),
            refusalOf({ url: 'see https://site.test' }),
            refusalOf({ timeout: 0 }),
            refusalOf({ timeout: -5 }),
            refusalOf({ timeout: Number.NaN }),
            refusalOf({ timeout: Number.POSITIVE_INFINITY }),
        ]).toStrictEqual([
            noUrl('site.test'),
            noUrl('ftp://site.test'),
            noUrl('https://'),
            noUrl('see https://site.test'),
            noDeadline('0'),
            noDeadline('-5'),
            noDeadline('NaN'),
            noDeadline('Infinity'),
        ]);
    });
});
