import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/** A module with no services, whose oracle is a golden: the golden is what makes it a spec (`result-compared-whole`). */
export const { cleanup, integration } = await specification.integration();

afterAll(cleanup);
