import { connect } from 'node:net';
import { onTestFinished } from 'vitest';

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
