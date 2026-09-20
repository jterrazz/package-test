import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';

/**
 * The repro of a SEAM defect, kept where the fix will be proven.
 *
 * `response.body.cancel()` on a reply `intercept()` served never resolves under
 * node: msw's interceptor holds the stream open, and the call hangs until the
 * test's budget kills it (measured on msw 2.15.0 — 30 s, then 5 s; reading the
 * same body with `.text()` resolves at once). It is interop between msw and
 * undici, not this package's code, and no upstream issue names a MOCKED reply —
 * the nearest is mswjs/interceptors#799, a passthrough body, closed as fixed.
 *
 * Until it answers, a subject whose own code cancels a body is the ONE case
 * with no `intercept()` to reach for: it keeps `vi.stubGlobal('fetch')` behind
 * a reasoned suppression of M3 ([10](../../../docs/10-contracts.md)). This spec
 * is the fix's acceptance test — unskip it, and the exception goes with it.
 */
describe('contracts — a body the subject cancels', () => {
    // oxlint-disable-next-line vitest/no-disabled-tests -- reason: the seam does not answer this yet (msw 2.15.0 hangs); the spec is the acceptance test of the fix, and skipping it is how the defect stays written down rather than remembered
    test.skip('a subject that drops the reply it was served finishes its request', async () => {
        // Given - one served reply, and an app that cancels the body instead of reading it
        const result = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'unread' }))
            .get('/cancel');

        // Then - the cancel resolves and the request completes
        expect(result.status).toBe(200);
        expect(result.response.body).toStrictEqual({ status: 200 });
    });
});
