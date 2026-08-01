import { CaptureScope, type Matcher } from '../matching/match.js';
import { structuralEquals } from '../matching/structural.js';

/**
 * A text filter on a provider request builder (`openai.chat({ user })`,
 * `anthropic.messages({ system })`, …).
 *
 * A **string is EXACT**. That is deliberate: a substring filter silently
 * cross-matches — two prompts sharing a preamble both satisfy the first
 * contract, and the spec goes green on the wrong reply. Looser matching is
 * explicit, and says which looseness it means:
 *
 * - a `RegExp` — pattern matching;
 * - `match.includes('…')` — containment, the code-only matcher (it never joins
 *   the `{{token}}` file vocabulary, CONVENTIONS D4);
 * - any other `match.*` matcher, evaluated by the same structural engine the
 *   assertions use.
 */
export type TextFilter = Matcher | RegExp | string;

/** Does an observed text satisfy a declared {@link TextFilter}? */
export function matchesText(filter: TextFilter | undefined, actual: string): boolean {
    if (filter === undefined) {
        return true;
    }
    if (typeof filter === 'string') {
        return actual === filter;
    }
    if (filter instanceof RegExp) {
        return filter.test(actual);
    }
    // A code matcher — one engine, shared with every structural comparison.
    return structuralEquals(filter, actual, new CaptureScope());
}
