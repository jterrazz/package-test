import { describe, expect, test } from 'vitest';

import { headersOf } from '../transport.js';

describe('transport', () => {
    test("headersOf — the headers an exchange sends — the url's host and the probe's agent, each replaced by a header the test names, a name read case-blind", () => {
        // Given - a request naming no header, and one naming the host, the agent and a header of its own in mixed case
        const url = new URL('https://site.test:8443/health');
        const sent = [
            headersOf({ headers: {}, method: 'GET', url }),
            headersOf({
                headers: {
                    Host: 'grafana.internal.test',
                    'User-Agent': 'GPTBot/1.0',
                    'X-Probe': 'a',
                },
                method: 'GET',
                url,
            }),
        ];

        // Then - one value per name, lower-cased, the test's winning
        expect(sent).toStrictEqual([
            { host: 'site.test:8443', 'user-agent': '@jterrazz/test' },
            { host: 'grafana.internal.test', 'user-agent': 'GPTBot/1.0', 'x-probe': 'a' },
        ]);
    });
});
