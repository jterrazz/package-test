import { specification } from '@jterrazz/test';
/** Intercepts are in-process (MSW), so the specimen runs in this process: `specimen-api-outbound`, whose routes only call out. */
import { afterAll } from 'vitest';

import { outboundApp } from './_fixtures/specimen-api-outbound/app.js';

export {
    NEWS_URL,
    PING_URL,
    QUOTES_URL,
    STREAM_URL,
} from './_fixtures/specimen-api-outbound/app.js';

export const { api, cleanup } = await specification.api({
    server: () => outboundApp,
});

afterAll(cleanup);
