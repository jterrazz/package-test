import { registerWorkerStubs } from '../network/worker.driver.js';
import { interceptThrough } from './module-intercept.js';
import type { Intercept } from './module-intercept.js';

/** The module-scope network double, on msw's worker. */
export const intercept: Intercept = interceptThrough(registerWorkerStubs);
