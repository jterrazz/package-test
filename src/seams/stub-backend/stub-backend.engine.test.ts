import { describe, expect, onTestFinished, test } from 'vitest';

import type { Contract } from '../../stubs/contract.js';
import { http } from '../../stubs/http/http.js';
import { stubBackend } from './stub-backend.engine.js';
import { StubBackend } from './stub-backend.js';

/** A GET contract replying `{ n }`. */
function get(path: string, n: number): Contract {
    return { request: http.get(path), response: http.json({ n }) };
}

describe('stubBackend — the network a chain is armed through', () => {
    test('a runner with no declared backend refuses a contract, naming the option on its own constructor', () => {
        // Given - a mobile runner that declared no backend
        const network = stubBackend(undefined, 'mobile');

        // Then - the refusal names specification.mobile, not the website's constructor
        expect(() => {
            network.accepts();
        }).toThrow(
            ".intercept(): this runner has no declared backend — add `backend` to the specification options (specification.mobile({ …, backend: { … } })) so the chain's contracts have a stub to serve them.",
        );
    });

    test('a chain declaring no contract is not failed by the chain before it', async () => {
        // Given - a chain that declared a contract, then met a request no contract answers
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

        // Then - the previous chain's contracts and its miss left with it
        expect(next.violation?.()).toBeNull();
        await expect(fetch(`${url}/events`)).resolves.toHaveProperty('status', 501);
    });

    test("arming a chain replaces the previous chain's contracts, and the stub's miss is the chain's failure", async () => {
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

        // Then - it is no contract of the second chain, whose failure names the miss
        expect(response.status).toBe(501);
        expect(second.violation?.()?.message).toContain('  - GET /events\n');
    });
});
