import { once } from 'node:events';
import { connect } from 'node:net';
import { onTestFinished } from 'vitest';

import { pause } from '../../../chain/pause.js';
import { http } from '../../kinds/http.js';
import type { Stub } from '../../stub.js';
import { StubBackend } from './stub-backend.js';

export function get(path: string, body: unknown, extra: Partial<Stub> = {}): Stub {
    return { request: http.get(path), response: http.json(body), ...extra };
}

export async function started(stubs: Stub[]): Promise<{ backend: StubBackend; url: string }> {
    const backend = new StubBackend();
    onTestFinished(async () => {
        await backend.stop();
    });
    const url = await backend.start();
    backend.beginChain(stubs);
    return { backend, url };
}

export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(url, init);
    return await response.json();
}

export async function statusOf(url: string): Promise<number> {
    const response = await fetch(url);
    return response.status;
}

/** Asks the port alone, no HTTP: undici can throw uncaught on a request to a socket that is closing. */
export async function isListening(url: string): Promise<boolean> {
    const { hostname, port } = new URL(url);
    return await new Promise((resolve) => {
        const socket = connect({ host: hostname, port: Number(port) });
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('error', () => {
            resolve(false);
        });
    });
}

/** A reply as a row: its status, its cors origin, its content type and its text. */
export async function replyOf(url: string, method = 'GET'): Promise<(null | number | string)[]> {
    const response = await fetch(url, { method });
    return [
        response.status,
        response.headers.get('access-control-allow-origin'),
        response.headers.get('content-type'),
        await response.text(),
    ];
}

/** A GET the backend has received and answers only after ten seconds: the socket stays open, closed when the test ends. */
export async function heldRequest(backend: StubBackend, url: string): Promise<void> {
    backend.beginChain([
        { request: http.get('/slow'), response: http.json({}, { delay: 10_000 }) },
    ]);
    const { hostname, port } = new URL(url);
    const socket = connect({ host: hostname, port: Number(port) });
    onTestFinished(() => {
        socket.destroy();
    });
    await once(socket, 'connect');
    socket.write(`GET /slow HTTP/1.1\r\nHost: ${hostname}\r\n\r\n`);
    // outside: the server reads the request on its own turn of the event loop; a tenth of a second lets it start the reply it holds.
    await pause(100);
}

/** Whether the backend stops before the deadline. */
export async function stopsWithin(backend: StubBackend, deadlineMs: number): Promise<boolean> {
    return await Promise.race([
        backend.stop().then(() => true),
        pause(deadlineMs).then(() => false),
    ]);
}
