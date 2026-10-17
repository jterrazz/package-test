import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';

export const { api, cleanup } = await specification.api({
    server: () => ({}) as never,
    services: { analyticsDb: postgres(), db: postgres() },
});

afterAll(cleanup);
