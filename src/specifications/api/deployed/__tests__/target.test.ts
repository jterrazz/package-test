import { describe, expect, test } from 'vitest';

import { connectAddress, hostOf, portOf, targetUrl } from '../target.js';

function refusalOf(work: () => unknown): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

const TARGET_WHY =
    'why: A request to a deployed api goes to one absolute http(s) URL: written whole, or a path from the `url` the specification names.';

describe('target', () => {
    test('targetUrl — the url one exchange goes to — a url written whole is itself, and a path is read from the base, its own path kept', () => {
        // Given - urls written whole, and paths under bases with and without a path of their own
        const urls = [
            targetUrl('https://site.test/health?full=1', 'https://other.test'),
            targetUrl('HTTP://site.test:8080/', 'https://other.test'),
            targetUrl('/health', 'https://site.test'),
            targetUrl('/health?x=1', 'https://site.test/app//'),
            targetUrl('/', 'http://[::1]:8443'),
        ];

        // Then - each read as an exchange sends it
        expect(urls.map(String)).toStrictEqual([
            'https://site.test/health?full=1',
            'http://site.test:8080/',
            'https://site.test/health',
            'https://site.test/app/health?x=1',
            'http://[::1]:8443/',
        ]);
    });

    test('targetUrl — the url one exchange goes to — refuses a url of another scheme, and a target that is no path', () => {
        // Given - each target no request can be sent to

        // Then - each refusal whole
        expect([
            refusalOf(() => targetUrl('ftp://site.test/file', 'https://site.test')),
            refusalOf(() => targetUrl('health', 'https://site.test')),
        ]).toStrictEqual([
            [
                'found: "ftp://site.test/file", a ftp URL',
                TARGET_WHY,
                'fix: name an http:// or https:// URL',
                'read: docs/guides/api-specs.md#the-target',
            ].join('\n'),
            [
                'found: "health", neither an absolute URL nor a path',
                TARGET_WHY,
                'fix: write the URL whole, `https://site.test/health`, or a path from the `url` option, `/health`',
                'read: docs/guides/api-specs.md#the-target',
            ].join('\n'),
        ]);
    });

    test("hostOf and portOf — where a url's socket opens — an IPv6 host without its brackets, and the port stated or the scheme's", () => {
        // Given - urls naming a v6 host, a stated port, and none
        const urls = ['http://[fd7a::1]:81/', 'https://site.test/', 'http://site.test/'].map(
            (url) => new URL(url),
        );

        // Then - the host and the port each socket opens on
        expect(urls.map((url) => [hostOf(url), portOf(url)])).toStrictEqual([
            ['fd7a::1', 81],
            ['site.test', 443],
            ['site.test', 80],
        ]);
    });

    test("connectAddress — the address .connect() names — a host and a port, a bracketed IPv6 one, or a bare host keeping the url's port", () => {
        // Given - each form, against an https url on its default port
        const url = new URL('https://site.test/');
        const addresses = ['10.0.0.5:30443', '[fd7a::1]:8443', '[fd7a::1]', ' node.test '].map(
            (written) => connectAddress(written, url),
        );

        // Then - the host and the port the socket opens on
        expect(addresses).toStrictEqual([
            { host: '10.0.0.5', port: 30_443 },
            { host: 'fd7a::1', port: 8443 },
            { host: 'fd7a::1', port: 443 },
            { host: 'node.test', port: 443 },
        ]);
    });

    test('connectAddress — the address .connect() names — refuses an address it cannot read, and brackets around no IPv6 address', () => {
        // Given - an empty address, a port with no host, a path, and bracketed text that is no v6 address
        const url = new URL('https://site.test/');
        const refused = ['', ':443', '10.0.0.5:443/path', '[node.test]:443'].map((written) =>
            refusalOf(() => connectAddress(written, url)),
        );

        // Then - each refused, naming what it was handed
        expect(refused).toStrictEqual(
            ['""', '":443"', '"10.0.0.5:443/path"', '"[node.test]:443"'].map((written) =>
                [
                    `found: .connect(${written}), no address`,
                    'why: `.connect()` names the one address the socket opens on: a host, and a port when it is not the port of the URL.',
                    "fix: write the address as `.connect('10.0.0.5:30443')`, `.connect('[fd7a::1]:443')` or `.connect('node.test')`",
                    'read: docs/guides/api-specs.md#setup-connect',
                ].join('\n'),
            ),
        );
    });
});
