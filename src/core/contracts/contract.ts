import type { InterceptResponseValue, InterceptTrigger } from './types.js';

/**
 * A declared external interaction: what to match and what to reply, together
 * in one named artifact. Contracts live in flat TypeScript files under
 * `contracts/` next to the tests that use them — `<name>.<provider>.ts` with
 * `provider ∈ { openai, anthropic, http }` (CONVENTIONS C4) — so the business
 * payload (prompts, JSON responses) is visible at a glance while the real
 * HTTP call stays mocked underneath (MSW).
 */
export interface InterceptContract {
    trigger: InterceptTrigger;
    /**
     * The reply — a fixed {@link InterceptResponse}, or a function
     * `(request) => InterceptResponse` evaluated per consumed request when the
     * response must derive from the incoming payload.
     */
    response: InterceptResponseValue;
}

/**
 * Declare an intercept contract. Identity function — its value is the
 * enforced shape and the naming convention:
 *
 * @example
 *   // specs/api/reports/contracts/classify-article.openai.ts
 *   import { defineContract, openai } from '@jterrazz/test';
 *
 *   export default defineContract({
 *       trigger: openai.responses({ user: /Report Ingestion/, tools: ['classify'] }),
 *       response: openai.reply({ categories: ['TECH'] }),
 *   });
 *
 *   // Dynamic — the response is computed from the observed request:
 *   export default defineContract({
 *       trigger: http.post('https://api.example.com/echo'),
 *       response: (request) => http.json({ received: request.body }),
 *   });
 *
 *   // specs/api/reports/reports.test.ts
 *   import classifyArticle from '../../spec/intercept/contracts/classify-article.openai.js';
 *
 *   const result = await jobs.intercept(classifyArticle).trigger('report-ingestion');
 */
export function defineContract(contract: InterceptContract): InterceptContract {
    return contract;
}
