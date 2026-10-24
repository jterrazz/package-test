// The deployment fixture: what a deployed edge answers, served in this
// process on ports the OS assigns, so no spec leaves the machine. One handler
// behind plain HTTP and three certificates (one a test authority signed, one
// long expired, one self-signed); a host header naming an internal host is
// refused, as an edge refuses one; a socket that accepts and never answers,
// in plain TCP and behind a completed handshake; and a port nothing listens on.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import type { AddressInfo, Server as TcpServer, Socket } from 'node:net';
import { resolve } from 'node:path';
import type { TLSSocket } from 'node:tls';

const certificate = (name: string): string =>
    readFileSync(resolve(import.meta.dirname, 'certificates', name), 'utf8');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function json(response: ServerResponse, status: number, value: unknown): void {
    response.writeHead(status, {
        'cache-control': 'no-store',
        'content-type': 'application/json',
        'x-frame-options': 'DENY',
    });
    response.end(JSON.stringify(value));
}

function answer(request: IncomingMessage, response: ServerResponse, body: string): void {
    const host = request.headers.host ?? '';
    if (host.startsWith('grafana.')) {
        response.writeHead(403, { 'content-type': 'text/plain' });
        response.end('forbidden host');
        return;
    }
    const servername = (request.socket as Partial<TLSSocket>).servername;
    const routes: Record<string, () => void> = {
        '/echo': () => {
            json(response, 200, {
                body,
                host,
                method: request.method,
                probe: request.headers['x-probe'] ?? null,
                servername: typeof servername === 'string' ? servername : null,
            });
        },
        '/health': () => {
            json(response, 200, { status: 'ok' });
        },
        '/logo.png': () => {
            response.writeHead(200, { 'content-type': 'image/png' });
            response.end(PNG);
        },
        '/old': () => {
            response.writeHead(301, { location: '/health' });
            response.end();
        },
    };
    const route = routes[(request.url ?? '/').split('?')[0] ?? '/'];
    if (route === undefined) {
        json(response, 404, { error: 'not found' });
        return;
    }
    route();
}

function handle(request: IncomingMessage, response: ServerResponse): void {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
        answer(request, response, Buffer.concat(chunks).toString('utf8'));
    });
}

function listening(server: Server | TcpServer): Promise<number> {
    return new Promise((done) => {
        server.listen(0, '127.0.0.1', () => {
            done((server.address() as AddressInfo).port);
        });
    });
}

function closed(server: Server | TcpServer): Promise<void> {
    return new Promise((done) => {
        server.close(() => {
            done();
        });
    });
}

/** The addresses each server answers on, and how to stop them all. */
export type Specimen = {
    close: () => Promise<void>;
    /** An https URL on 127.0.0.1, its certificate expired in 2021. */
    expired: string;
    /** The port of the https server whose certificate the test authority signed for `site.test`, `*.site.test`, `localhost` and `127.0.0.1`. */
    securePort: number;
    /** An https URL on 127.0.0.1, its certificate the test authority signed. */
    secure: string;
    /** An https URL whose handshake completes and whose request is never answered. */
    secureSilent: string;
    /** An https URL on 127.0.0.1, its certificate signed by no authority. */
    selfSigned: string;
    /** A plain http URL on 127.0.0.1. */
    plain: string;
    /** The port of the plain http server. */
    plainPort: number;
    /** An http URL on a port nothing listens on. */
    refused: string;
    /** An http URL whose socket accepts and never answers. */
    silent: string;
};

/** Every server starts before the first spec, and a closed port is one the OS gave and took back. */
export async function serveSpecimen(): Promise<Specimen> {
    const key = certificate('site.key');
    const plain = createServer(handle);
    const secure = createSecureServer({ cert: certificate('site.pem'), key }, handle);
    const expired = createSecureServer({ cert: certificate('expired.pem'), key }, handle);
    const selfSigned = createSecureServer({ cert: certificate('self-signed.pem'), key }, handle);
    const held: Socket[] = [];
    const secureSilent = createSecureServer({ cert: certificate('site.pem'), key }, (request) => {
        held.push(request.socket);
    });
    const silent = createTcpServer((socket) => {
        held.push(socket);
    });
    const vacated = createTcpServer();

    const servers = [plain, secure, expired, selfSigned, silent, secureSilent];
    const [plainPort, securePort, expiredPort, selfSignedPort, silentPort, secureSilentPort] =
        await Promise.all(servers.map(listening));
    const refusedPort = await listening(vacated);
    await closed(vacated);

    return {
        close: async () => {
            for (const socket of held) {
                socket.destroy();
            }
            await Promise.all(servers.map(closed));
        },
        expired: `https://127.0.0.1:${String(expiredPort)}`,
        plain: `http://127.0.0.1:${String(plainPort)}`,
        plainPort: plainPort ?? 0,
        refused: `http://127.0.0.1:${String(refusedPort)}`,
        secure: `https://127.0.0.1:${String(securePort)}`,
        securePort: securePort ?? 0,
        secureSilent: `https://127.0.0.1:${String(secureSilentPort)}`,
        selfSigned: `https://127.0.0.1:${String(selfSignedPort)}`,
        silent: `http://127.0.0.1:${String(silentPort)}`,
    };
}
