import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';

export const { cleanup, cli } = await specification.cli('./bin', {
    transform: (text) => text.replace(/^\[worker-\d+\] /gm, ''),
});

afterAll(cleanup);
