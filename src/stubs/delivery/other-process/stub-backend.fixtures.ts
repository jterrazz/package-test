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
