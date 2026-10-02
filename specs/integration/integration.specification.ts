import { postgres, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, integration } = await specification.integration({
    root: '../_shared/_fixtures/specimen-api',
    services: { db: postgres() },
});

afterAll(cleanup);
