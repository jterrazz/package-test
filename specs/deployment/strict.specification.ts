import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/** No base and no private authority: every URL is written whole, and only the system's authorities are trusted; the deadline leaves a loaded machine's resolver time to answer. */
export const { cleanup, deployment } = await specification.deployment({ timeout: 10_000 });

afterAll(cleanup);
