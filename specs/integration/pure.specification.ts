import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/**
 * The other half of the facet: a module with NO services, whose oracle is a
 * golden. What makes it a spec rather than a module test is the golden — a
 * `.test.ts` beside its module compares to a literal (rule D20).
 */
export const { cleanup, integration } = await specification.integration();

afterAll(cleanup);
