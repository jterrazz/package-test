import { afterAll } from 'vitest';

import { postgres, specification } from '@jterrazz/test';

export const { api, cleanup } = await specification.api({
    server: () => ({}) as never,
    services: { analyticsDb: postgres(), db: postgres() },
});

afterAll(cleanup);
