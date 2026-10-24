import { describe, expect, test } from 'vitest';

import { deployment } from '../deployment.specification.js';

describe('host', () => {
    test("a host header the test names replaces the url's, and the edge judges that host", async () => {
        // Given - the public address, asked for an internal host
        const result = await deployment.headers({ Host: 'grafana.internal.test' }).get('/health');

        // Then - refused
        expect(result.response).toMatch(`
            HTTP/1.1 403 Forbidden
            content-type: text/plain

            forbidden host
        `);
    });
});
