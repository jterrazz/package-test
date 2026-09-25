import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { url as running } from './website.specification.js';

/** Targets the fixture site the default runner started, so no network is left to chance. */
export const { cleanup, website } = await specification.website({ url: running });

afterAll(cleanup);
