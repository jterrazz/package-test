import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { url as running } from './website.specification.js';

/**
 * The runner for a site already running — a deployment, a preview. It targets
 * the fixture site the default runner started, so the address is one this
 * repository owns and no network is left to chance.
 */
export const { cleanup, website } = await specification.website({ url: running });

afterAll(cleanup);
