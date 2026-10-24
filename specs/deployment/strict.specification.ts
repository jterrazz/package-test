import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/** No base and no private authority: every URL is written whole, and only the system's authorities are trusted. */
export const { cleanup, deployment } = await specification.deployment({ timeout: 1000 });

afterAll(cleanup);
