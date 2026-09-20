import { afterAll } from 'vitest';

import { specification } from '@jterrazz/test';

export const { cleanup, cli } = await specification.cli('./bin/app.sh');

afterAll(cleanup);
