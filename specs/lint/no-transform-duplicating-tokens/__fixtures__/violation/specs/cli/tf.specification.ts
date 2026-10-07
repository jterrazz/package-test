import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';

export const { cleanup, cli } = await specification.cli('./bin', {
    transform: (text) => text.replace(/[0-9a-f-]{36}/g, '{{uuid}}'),
});

afterAll(cleanup);
