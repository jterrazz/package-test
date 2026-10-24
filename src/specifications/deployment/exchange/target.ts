import { isIP } from 'node:net';

import { refusal } from '../../../chain/refusals/refusal.js';

/** A host and a port a socket opens on. */
export type Address = { host: string; port: number };

const SCHEME = /^[a-z][a-z\d+.-]*:\/\//iu;

const BRACKETED = /^\[(?<host>[^\]]+)\](?::(?<port>\d+))?$/u;

const HOST_AND_PORT = /^(?<host>[^:[\]\s]+)(?::(?<port>\d+))?$/u;

/** The host a URL names, an IPv6 literal without its brackets. */
export function hostOf(url: URL): string {
    return url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
}

/** The port a URL names, or its scheme's. */
export function portOf(url: URL): number {
    if (url.port !== '') {
        return Number(url.port);
    }
    return url.protocol === 'https:' ? 443 : 80;
}

function refusedTarget(target: string, found: string, fix: string): Error {
    return new Error(
        refusal({
            fix,
            found: `${JSON.stringify(target)}, ${found}`,
            read: 'docs/guides/deployment-specs.md#the-target',
            why: 'An exchange goes to one absolute http(s) URL: written whole, or a path from the `url` the specification names.',
        }),
    );
}

/** A path is read from the base URL as written, its own path kept: `https://site.test/app` and `/health` are `https://site.test/app/health`. */
export function targetUrl(target: string, base: string | undefined): URL {
    if (SCHEME.test(target)) {
        const url = new URL(target);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw refusedTarget(
                target,
                `a ${url.protocol.slice(0, -1)} URL`,
                'name an http:// or https:// URL',
            );
        }
        return url;
    }
    if (!target.startsWith('/')) {
        throw refusedTarget(
            target,
            'neither an absolute URL nor a path',
            'write the URL whole, `https://site.test/health`, or a path from the `url` option, `/health`',
        );
    }
    if (base === undefined) {
        throw refusedTarget(
            target,
            'a path, and the specification names no `url` to read it from',
            'write the URL whole, or name the base with `specification.deployment({ url })`',
        );
    }
    return new URL(`${base.replace(/\/+$/u, '')}${target}`);
}

/** `host:port`, `[v6]:port`, or a bare host, which keeps the URL's port. */
export function connectAddress(written: string, url: URL): Address {
    const address = written.trim();
    const match = BRACKETED.exec(address) ?? HOST_AND_PORT.exec(address);
    // Stryker disable next-line OptionalChaining: a match always carries its named groups
    const host = match?.groups?.host;
    if (host === undefined || (address.startsWith('[') && isIP(host) !== 6)) {
        throw new Error(
            refusal({
                fix: "write the address as `.connect('10.0.0.5:30443')`, `.connect('[fd7a::1]:443')` or `.connect('node.test')`",
                found: `.connect(${JSON.stringify(written)}), no address`,
                read: 'docs/guides/deployment-specs.md#setup-connect',
                why: '`.connect()` names the one address the socket opens on: a host, and a port when it is not the port of the URL.',
            }),
        );
    }
    const port = match?.groups?.port;
    return { host, port: port === undefined ? portOf(url) : Number(port) };
}
