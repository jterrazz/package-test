import { specification } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';
/* oxlint-disable jterrazz/runner-in-specification-file -- negative constructor specs: every specification.api() call here is refused before it builds or requests anything, so no runner exists to live in a *.specification.ts file */
import { describe, expect, test } from 'vitest';

const refusal = (found: string, why: string, fix: string): string =>
    [
        `found: ${found}`,
        `why: ${why}`,
        `fix: ${fix}`,
        'read: docs/guides/api-specs.md#options',
    ].join('\n');

const server = () => ({ request: () => new Response() });

describe('refused', () => {
    test('a base that is no http(s) url is refused before the first request', async () => {
        // Given - a host written without its scheme, as a variable often holds it
        const options = { url: 'site.test' };

        // Then - refused, naming the base it was handed
        await expect(specification.api(options)).rejects.toThrow(
            refusal(
                'specification.api({ url: "site.test" }), no http(s) URL',
                'A path is read from the base `url`, so the base is an absolute http:// or https:// URL.',
                "name the deployed api's base as an absolute URL, `url: 'https://site.test'`",
            ),
        );
    });

    test('an empty url is refused, as an environment variable left unset hands it', async () => {
        // Given - a url read from an environment variable nobody set
        const options = { url: '' };

        // Then - refused: there is no app to request
        await expect(specification.api(options)).rejects.toThrow(
            refusal(
                'specification.api({ url: "" }), no app to specify',
                'An api spec names the app it requests: a `server` it builds in this process, or a deployed `url`.',
                'build the app with `server`, or pass the absolute URL of the deployed api as `url`',
            ),
        );
    });

    test('a deadline that is no positive number of milliseconds is refused', async () => {
        // Given - a timeout of zero
        const options = { timeout: 0, url: 'https://site.test' };

        // Then - refused: no request could ever answer in time
        await expect(specification.api(options)).rejects.toThrow(
            refusal(
                'specification.api({ url, timeout: 0 }), no deadline',
                'A request that never answers reads `unreachable: timeout` once its deadline passes, so the deadline is a positive number of milliseconds.',
                'pass the milliseconds one request may take, `timeout: 2000`, or leave the 5000 default',
            ),
        );
    });

    test('a server and a url together are refused, for a caller the types do not reach', async () => {
        // Given - an app built here beside a deployed one, which the type refuses
        // Then - refused at run time too
        await expect(
            // @ts-expect-error -- `server` and `url` are exclusive: the pair is what the type refuses
            specification.api({ server, url: 'https://site.test' }),
        ).rejects.toThrow(
            refusal(
                'specification.api({ server, url }), an app built here beside a deployed one',
                '`server` and `url` are exclusive: a request goes to the app this process builds, or to the one deployed at the url.',
                'keep `server` to test the app in this process, or `url` to probe the deployed one',
            ),
        );
    });

    test('an option of a deployed api beside a server is refused', async () => {
        // Given - a deadline and an authority handed to an app built in this process
        // Then - refused: no request of it crosses the network
        await expect(
            // @ts-expect-error -- `timeout` and `ca` belong to a `url`: the type refuses them beside `server`
            specification.api({ ca: 'pem', server, timeout: 10 }),
        ).rejects.toThrow(
            refusal(
                'specification.api({ server, ca, timeout }), an option of a deployed api beside an app built here',
                '`ca`, `insecure`, `recordedHeaders` and `timeout` shape requests sent over the network, which a `url` names; an app built in this process is answered without one.',
                'drop them, or name the deployed api with `url`',
            ),
        );
    });

    test('services beside a url are refused: a deployed api is wired to its own', async () => {
        // Given - a database declared for an api deployed elsewhere
        // Then - refused before any container starts
        await expect(
            // @ts-expect-error -- services are wired into an app built here: the type refuses them beside `url`
            specification.api({ services: { db: postgres() }, url: 'https://site.test' }),
        ).rejects.toThrow(
            refusal(
                'specification.api({ url, services }), services beside a deployed url',
                'A deployed api is wired to its own services: services started here never reach it.',
                'drop `services` and `root`, or build the app with `server` to wire them',
            ),
        );
    });
});
