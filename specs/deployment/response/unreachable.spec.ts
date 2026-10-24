import { describe, expect, test } from 'vitest';

import { deployment, specimen } from '../deployment.specification.js';

describe('unreachable', () => {
    test('a port nothing listens on is refused, and the refusal is the result', async () => {
        // Given - a port the OS gave back
        const result = await deployment.get(`${specimen.refused}/health`);

        // Then - one line says why no response came
        expect(result.response).toMatch('unreachable: refused');
        expect(result.tls).toBeUndefined();
    });

    test('a name no resolver knows is a dns failure', async () => {
        // Given - a host under .invalid, which never resolves
        const result = await deployment.get('http://nowhere.invalid/health');

        // Then - the name, not the network, is why
        expect(result.response).toMatch('unreachable: dns');
    });

    test('an answer expected where none came fails, naming both outcomes', async () => {
        // Given - a golden expecting the health answer from a closed port
        const result = await deployment.get(`${specimen.refused}/health`);

        // Then - the outcome mismatch states what was expected and what came
        expect(() => {
            expect(result.response).toMatch('HTTP/1.1 200 OK', { frozen: true });
        }).toThrow(
            'Response outcome mismatch (the value in place)\n  expected: HTTP/1.1 200\n  received: unreachable: refused',
        );
    });
});
