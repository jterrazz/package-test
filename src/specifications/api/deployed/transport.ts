import { request } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { isIP, connect as openTcp } from 'node:net';
import type { Socket } from 'node:net';
import { checkServerIdentity, getCACertificates, connect as openTls } from 'node:tls';

import { hostOf, portOf } from './target.js';
import type { Address } from './target.js';
import { tlsFacts } from './tls-facts.js';
import type { TlsFacts } from './tls-facts.js';
import { codeOf, refusedCertificate, TIMEOUT, unreachableReason } from './unreachable.js';

/** One request, as it leaves: its URL, method, headers and body. */
export type Sent = {
    body?: string | undefined;
    headers: Readonly<Record<string, string>>;
    method: string;
    url: URL;
};

/** How it leaves: where the socket opens, how long the whole exchange may take, and which certificates are trusted. */
export type Route = {
    /** Trusted beside the authorities node trusts, PEM. */
    ca?: string | undefined;
    /** Opened instead of the URL's host and port; the Host header and the TLS server name stay the URL's. */
    connect?: Address | undefined;
    /** Accept a certificate the trust check refuses; its facts still say why. */
    insecure: boolean;
    timeout: number;
};

type Unreachable = { readonly tls: TlsFacts | undefined; readonly unreachable: string };

/** What came back: a response, or why none did, and the certificate a TLS handshake presented either way. */
export type Answer =
    | Unreachable
    | {
          readonly headers: Record<string, string>;
          readonly status: number;
          readonly text: string;
          readonly tls: TlsFacts | undefined;
          readonly unreachable?: undefined;
      };

type Opened = { readonly socket: Socket; readonly tls: TlsFacts | undefined };

// outside: the probe names itself, as curl does, so an edge that refuses an empty agent answers it like any client.
const USER_AGENT = '@jterrazz/test';

// invariant: a repeated header (`set-cookie`) is one line, its values in the order they came.
function flatHeaders(headers: IncomingHttpHeaders): Record<string, string> {
    return Object.fromEntries(
        Object.entries(headers).map(([name, value]) => [
            name,
            Array.isArray(value) ? value.join(', ') : String(value),
        ]),
    );
}

// invariant: a name is read case-blind, so a test's `Host` replaces the one the URL names rather than joining it.
export function headersOf(sent: Sent): Record<string, string> {
    const headers: Record<string, string> = { host: sent.url.host, 'user-agent': USER_AGENT };
    for (const [name, value] of Object.entries(sent.headers)) {
        headers[name.toLowerCase()] = value;
    }
    return headers;
}

async function opened(socket: Socket, event: 'connect' | 'secureConnect'): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        socket.once(event, () => {
            resolve();
        });
        socket.once('error', reject);
    });
}

// invariant: the trust check is made here, never by the socket: a refused certificate still states its facts.
async function openSecure(
    address: Address,
    url: URL,
    route: Route,
    hold: (socket: Socket) => void,
): Promise<Opened | Unreachable> {
    const name = hostOf(url);
    const socket = openTls({
        checkServerIdentity: (_host, certificate) => checkServerIdentity(name, certificate),
        host: address.host,
        port: address.port,
        rejectUnauthorized: false,
        // invariant: node's `ca` replaces the authorities it trusts; a private one is trusted beside them.
        ...(route.ca === undefined ? {} : { ca: [...getCACertificates('default'), route.ca] }),
        ...(isIP(name) === 0 ? { servername: name } : {}),
    });
    hold(socket);
    try {
        await opened(socket, 'secureConnect');
    } catch (error) {
        return { tls: undefined, unreachable: unreachableReason(error, true) };
    }
    // outside: node types the refusal as an Error, and sets the code it read, a string.
    const refused = socket.authorized ? undefined : codeOf(socket.authorizationError);
    const tls = tlsFacts(
        socket.getPeerCertificate(),
        { authorizationError: refused, protocol: socket.getProtocol() ?? undefined },
        Date.now(),
    );
    return refused === undefined || route.insecure
        ? { socket, tls }
        : { tls, unreachable: refusedCertificate(refused) };
}

// invariant: a name is resolved by the socket itself, which tries each address it resolves to, an IPv4 one when IPv6 has no route.
async function open(
    sent: Sent,
    route: Route,
    hold: (socket: Socket) => void,
): Promise<Opened | Unreachable> {
    const address = route.connect ?? { host: hostOf(sent.url), port: portOf(sent.url) };
    if (sent.url.protocol === 'https:') {
        return await openSecure(address, sent.url, route, hold);
    }
    const socket = openTcp(address);
    // Stryker disable next-line CallExpression: a socket left to its server is a leak, never a different answer
    hold(socket);
    await opened(socket, 'connect');
    return { socket, tls: undefined };
}

async function exchanged(
    sent: Sent,
    socket: Socket,
): Promise<{ response: IncomingMessage; text: string }> {
    return await new Promise((resolve, reject) => {
        const outgoing = request(
            {
                createConnection: () => socket,
                headers: headersOf(sent),
                method: sent.method,
                path: `${sent.url.pathname}${sent.url.search}`,
            },
            (response) => {
                const chunks: Buffer[] = [];
                response.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });
                response.once('end', () => {
                    resolve({ response, text: Buffer.concat(chunks).toString('utf8') });
                });
                // Stryker disable next-line StringLiteral,CallExpression: a response that fails mid-body is a reset no local server provokes on demand
                response.once('error', reject);
            },
        );
        outgoing.once('error', reject);
        outgoing.end(sent.body);
    });
}

async function answered(
    sent: Sent,
    route: Route,
    hold: (socket: Socket) => void,
    presented: (tls: TlsFacts | undefined) => void,
): Promise<Answer> {
    const opening = await open(sent, route, hold);
    presented(opening.tls);
    if (!('socket' in opening)) {
        return opening;
    }
    const { response, text } = await exchanged(sent, opening.socket);
    return {
        headers: flatHeaders(response.headers),
        status: response.statusCode ?? 0,
        text,
        tls: opening.tls,
    };
}

/** One request and its whole response, under one deadline; a redirect is the answer, never followed. */
export async function exchange(sent: Sent, route: Route): Promise<Answer> {
    const sockets: Socket[] = [];
    let tls: TlsFacts | undefined;
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<Answer>((resolve) => {
        timer = setTimeout(() => {
            resolve({ tls, unreachable: TIMEOUT });
        }, route.timeout);
    });
    try {
        return await Promise.race([
            answered(
                sent,
                route,
                (held) => {
                    sockets.push(held);
                },
                (facts) => {
                    tls = facts;
                },
            ),
            deadline,
        ]);
    } catch (error) {
        return { tls, unreachable: unreachableReason(error) };
    } finally {
        // Stryker disable next-line CallExpression: a deadline left armed resolves a race already settled, which changes no answer
        clearTimeout(timer);
        for (const socket of sockets) {
            socket.destroy();
        }
    }
}
