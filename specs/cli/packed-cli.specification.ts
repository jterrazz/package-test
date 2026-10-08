import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

// invariant: a consumer spec meets this package as its consumers install it: each chain links `@jterrazz/test` packed, from its own spec file, where `packed()` finds the project.
export const { cleanup, cli } = await specification.cli('node');

afterAll(cleanup);
