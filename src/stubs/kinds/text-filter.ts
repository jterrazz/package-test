import { CaptureScope } from '../../expectations/tokens/match.js';
import type { Matcher } from '../../expectations/tokens/match.js';
import { structuralEquals } from '../../expectations/tokens/structural.js';

/** A text filter on a provider request builder: a string is exact, a `RegExp` or `match.*` loosens it. */
export type TextFilter = Matcher | RegExp | string;

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
    // A code matcher: the one structural comparison every assertion makes.
    return structuralEquals(filter, actual, new CaptureScope());
}
