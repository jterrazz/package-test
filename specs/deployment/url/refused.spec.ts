import { specification } from '@jterrazz/test';
/* oxlint-disable jterrazz/runner-in-specification-file -- negative constructor specs: every specification.deployment() call here is refused before it sends anything, so no runner exists to live in a *.specification.ts file */
import { describe, expect, test } from 'vitest';

describe('refused', () => {
    test('a base that is no http(s) url is refused before the first exchange', async () => {
        // Given - a host written without its scheme, as a variable often holds it
        const options = { url: 'site.test' };

        // Then - refused, naming the base it was handed
        await expect(specification.deployment(options)).rejects.toThrow(
            [
                'found: specification.deployment({ url: "site.test" }), no http(s) URL',
                'why: A path is read from the base `url`, so the base is an absolute http:// or https:// URL.',
                "fix: name the deployment's base as an absolute URL, `url: 'https://site.test'`, or leave it out and write each URL whole",
                'read: docs/guides/deployment-specs.md#options',
            ].join('\n'),
        );
    });

    test('a deadline that is no positive number of milliseconds is refused', async () => {
        // Given - a timeout of zero
        const options = { timeout: 0 };

        // Then - refused: no exchange could ever answer in time
        await expect(specification.deployment(options)).rejects.toThrow(
            [
                'found: specification.deployment({ timeout: 0 }), no deadline',
                'why: An exchange that never answers reads `unreachable: timeout` once its deadline passes, so the deadline is a positive number of milliseconds.',
                'fix: pass the milliseconds one exchange may take, `timeout: 2000`, or leave the 5000 default',
                'read: docs/guides/deployment-specs.md#options',
            ].join('\n'),
        );
    });
});
