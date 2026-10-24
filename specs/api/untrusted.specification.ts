import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { specimen } from './deployed.specification.js';

/** No private authority: only the system's are trusted; the deadline leaves a loaded machine's resolver time to answer. */
export const { api, cleanup } = await specification.api({ timeout: 10_000, url: specimen.plain });

afterAll(cleanup);
