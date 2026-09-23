import { defineContracts } from '../../../../src/index.js';
import enrichLabel from './http/enrich-label.js';

/**
 * The facade a document intercepts with (C10): its default export is the
 * world under contract — what `intercept: ./contracts/enrich-label.contracts.ts`
 * registers.
 */
export default defineContracts(enrichLabel);
