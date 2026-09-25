import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/** A module with no services, whose oracle is a golden: the golden is what makes it a spec (D20). */
export const { cleanup, integration } = await specification.integration();

afterAll(cleanup);
