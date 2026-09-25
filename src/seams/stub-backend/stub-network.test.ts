import { describe, expect, onTestFinished, test } from 'vitest';

import type { Contract } from '../../stubs/contract.js';
import { http } from '../../stubs/http/http.js';
import { StubBackend } from './stub-backend.js';
import { stubBackend } from './stub-network.js';

/** A GET contract replying `{ n }`. */
function get(path: string, n: number): Contract {
    return { request: http.get(path), response: http.json({ n }) };
}

describe('stubBackend — the network of a chain whose subject runs in its own process', () => {
    test('a runner with no declared backend refuses the setup, naming the option on its own constructor', () => {
        // Given - a website runner started without `backend`
        const network = stubBackend(undefined, 'website');

        // Then - the refusal says which option of which constructor serves the contracts
        expect(() => {
            network.accepts();
        }).toThrow(
            '.intercept(): this runner has no declared backend — add `backend` to the specification options (specification.website({ …, backend: { … } }))',
        );
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
