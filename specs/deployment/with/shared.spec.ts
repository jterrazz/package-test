import { describe, expect, test } from 'vitest';

import { deployment } from '../deployment.specification.js';

const probed = deployment.with({ headers: { 'x-probe': 'shared' } });

describe('shared', () => {
    test('the headers a file shares are sent by every chain it starts', async () => {
        // Given - a chain started from the shared view
        const result = await probed.get('/echo');

        // Then - the shared header arrived
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK

            {"body": "", "host": "127.0.0.1:{{port}}", "method": "GET", "probe": "shared", "servername": null}
        `);
    });
});
