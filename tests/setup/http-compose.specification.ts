import { afterAll } from 'vitest';

import { spec, stack } from '../../src/index.js';

export const httpComposeSpec = await spec(stack('./fixtures/app'));

afterAll(() => httpComposeSpec.cleanup());
