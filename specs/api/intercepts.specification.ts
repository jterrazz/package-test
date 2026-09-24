/**
 * Runner for the strict-intercept specs (CONVENTIONS D7). Intercepts are
 * in-process (MSW), so the specimen under test runs in this process:
 * `specs/shared/fixtures/specimen-api-outbound/`, whose routes only call out.
 */
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';
import { outboundApp } from '../shared/fixtures/specimen-api-outbound/app.js';

export { NEWS_URL, QUOTES_URL, STREAM_URL } from '../shared/fixtures/specimen-api-outbound/app.js';

export const { api, cleanup } = await specification.api({
    server: () => outboundApp,
});

afterAll(cleanup);
