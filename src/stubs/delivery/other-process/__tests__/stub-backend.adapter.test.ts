import { describe, expect, onTestFinished, test } from 'vitest';

import { http } from '../../../kinds/http.js';
import type { Stub } from '../../../stub.js';
import { stubBackend } from '../stub-backend.adapter.js';
import { StubBackend } from '../stub-backend.js';

function get(path: string, n: number): Stub {
    return { request: http.get(path), response: http.json({ n }) };
}

describe('stubBackend', () => {
    test('stubBackend — the network a chain is armed through — a runner with no declared backend refuses a stub, naming the option on its own constructor', () => {
        // Given - a mobile runner that declared no backend
        const network = stubBackend(undefined, 'mobile');

        // Then - the refusal names specification.mobile, not the website's constructor
        expect(() => {
            network.accepts();
        }).toThrow(
            [
                'found: .intercept(), and this runner has no declared backend',
                'why: A site, an app or a binary is served its stubs by a declared stub backend, the URL it reads in place of its API.',
                "fix: add `backend` to the specification options: specification.mobile({ …, backend: { env: 'API_URL' } })",
                'read: docs/guides/mobile-specs.md#declared-backend',
            ].join('\n'),
        );
    });

    test('stubBackend — the network a chain is armed through — a website runner with no declared backend is pointed at the website chapter', () => {
        // Given - a website runner that declared no backend
        const network = stubBackend(undefined, 'website');

        // Then - the refusal names specification.website and its chapter
        expect(() => {
            network.accepts();
        }).toThrow(
            [
                "fix: add `backend` to the specification options: specification.website({ …, backend: { env: 'API_URL' } })",
                'read: docs/guides/website-specs.md#declared-backend',
            ].join('\n'),
        );
    });

    test('stubBackend — the network a chain is armed through — a chain declaring no stub is not failed by the chain before it', async () => {
        // Given - a chain that declared a stub, then met a request no stub answers
        const backend = new StubBackend();
        const url = await backend.start();
        onTestFinished(async () => {
            await backend.stop();
        });
        const network = stubBackend(backend, 'mobile');
        const first = await network.arm([
            { request: http.get('/events'), response: http.json({ n: 1 }) },
        ]);
        await fetch(`${url}/miss`);
        expect(first.violation?.()).toBeInstanceOf(Error);

        // When - the next chain, declaring nothing, is armed
        const next = await network.arm([]);

        // Then - the previous chain's stubs and its miss left with it
        expect(next.violation?.()).toBeNull();
        await expect(fetch(`${url}/events`)).resolves.toHaveProperty('status', 501);
    });

    test("stubBackend — the network a chain is armed through — arming a chain replaces the previous chain's stubs, and the stub's miss is the chain's failure", async () => {
        // Given - a started stub, armed by a first chain, then by a second declaring another route
        const backend = new StubBackend();
        onTestFinished(async () => {
            await backend.stop();
        });
        const url = await backend.start();
        const network = stubBackend(backend, 'website');
        await network.arm([get('/events', 1)]);
        const second = await network.arm([get('/articles', 2)]);

        // When - the site asks for the first chain's route
        const response = await fetch(`${url}/events`);

        // Then - it is no stub of the second chain, whose failure names the miss
        expect(response.status).toBe(501);
        expect(second.violation?.()?.message).toContain('  - GET /events\n');
    });
});
