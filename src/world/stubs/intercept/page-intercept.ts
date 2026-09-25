import { registerWorkerStubs } from '../network/worker.engine.js';
import { interceptThrough } from './module-intercept.js';
import type { Intercept } from './module-intercept.js';

/**
 * The module-scope network double, on msw's WORKER — the same stubs and the
 * same strictness the node entry publishes, served by the one engine a page
 * has.
 */
export const intercept: Intercept = interceptThrough(registerWorkerStubs);
