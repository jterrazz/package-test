import { interceptThrough } from '../../intercept/intercept.js';
import type { Intercept } from '../../intercept/intercept.js';
import { registerWorkerStubs } from './msw-worker.adapter.js';

/** The module-scope network double, on msw's worker. */
export const intercept: Intercept = interceptThrough(registerWorkerStubs);
