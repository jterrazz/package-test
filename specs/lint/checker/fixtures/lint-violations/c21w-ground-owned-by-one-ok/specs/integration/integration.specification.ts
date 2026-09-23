import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { integration, cleanup } = await specification.integration({});

afterAll(cleanup);
