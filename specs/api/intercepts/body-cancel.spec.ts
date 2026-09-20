import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { api, QUOTES_URL } from '../intercepts.specification.js';

/**
 * The repro of a SEAM defect, kept where the fix will be proven.
 *
 * `response.body.cancel()` on a reply `intercept()` served never resolves under
 * node: the call hangs until the test's budget kills it, while reading the same
 * body with `.text()` resolves at once.
 *
 * The cause is msw's own tee, above the interceptor: msw hands the caller ONE
 * BRANCH of a teed stream, keeping the other for its `response` lifecycle
 * event, and a tee branch's `cancel()` resolves only once BOTH branches have
 * been cancelled — which msw's never is. Measured on msw 2.15.0 with
 * `@mswjs/interceptors` 0.41.9: a real server cancels in 12 ms, the
 * interceptor alone cancels in 12 ms, and msw hangs on a PASSTHROUGH request
 * exactly as it does on a mocked one (docs/16 § A cancelled body does not
 * settle).
 *
 * Until it answers, a subject whose own code cancels a body is the ONE case
 * with no `intercept()` to reach for: it keeps `vi.stubGlobal('fetch')` behind
 * a reasoned suppression of M3 ([16](../../../docs/16-contracts.md)). This spec
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
