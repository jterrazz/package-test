import { describe, expect, test } from 'vitest';

import { api, specimen } from '../deployed.specification.js';
import { api as untrusted } from '../untrusted.specification.js';

describe('unreachable', () => {
    test('a port nothing listens on is refused, and the refusal is the result', async () => {
        // Given - a port the OS gave back
        const result = await api.get(`${specimen.refused}/health`);

        // Then - one line says why no response came
        expect(result.response).toMatch('unreachable: refused');
        expect(result.tls).toBeUndefined();
    });

    test('a name no resolver can answer is a dns failure', async () => {
        // Given - a host whose first label is longer than DNS allows, which every resolver refuses on the machine, network or none
        const result = await untrusted.get(`http://${'a'.repeat(64)}.invalid/health`);

        // Then - the name, not the network, is why
        expect(result.response).toMatch('unreachable: dns');
    });

    test('an answer expected where none came fails, naming both outcomes', async () => {
        // Given - a golden expecting the health answer from a closed port
        const result = await api.get(`${specimen.refused}/health`);

        // Then - the outcome mismatch states what was expected and what came
        expect(() => {
            expect(result.response).toMatch('HTTP/1.1 200 OK', { frozen: true });
        }).toThrow(
            'Response outcome mismatch (the value in place)\n  expected: HTTP/1.1 200\n  received: unreachable: refused',
        );
    });
});
