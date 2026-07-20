import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';

export const { cleanup, website } = await specification.website({
    server: { command: 'node app.mjs' },
});

afterAll(cleanup);
