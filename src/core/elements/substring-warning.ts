/* oxlint-disable eslint/no-console -- the warning IS the product here: a transitional notice that reaches the author has nowhere else to go, and a logger the consumer configures would let it be silenced by the very setup it is warning about. */
import type { ElementRef } from '../ports/browser.port.js';

/**
 * The transitional warning for a name that matches only as a SUBSTRING.
 *
 * Until 16.0 a descriptor's name matched any element whose accessible name
 * CONTAINED it, so `link('Articles')` also designated "Read Articles" — and a
 * test could pass for years against the wrong element without anyone noticing,
 * because the wrong element was usually next to the right one. Exact is the
 * default now.
 *
 * A lint rule cannot carry this: whether a name matched whole or in part is a
 * fact about a RUN, and a verdict fed by a previous run's artefact is not
 * deterministic. So it is a runtime warning, printed by the adapter that did
 * the looking, at the moment it has both answers in hand — nothing found under
 * exact, something found under substring.
 *
 * It is printed ONCE per descriptor per process: a scenario that clicks the
 * same link in ten tests has one thing to fix, not ten lines to read.
 */

/** How long the two-release window lasts, stated in the message itself. */
const WINDOW = '16.0 and 16.1';

/** Descriptors already reported in this process. */
const reported = new Set<string>();

/** The identity a descriptor is deduplicated by — kind, name, and its scope chain. */
function identityOf(element: ElementRef): string {
    const own = `${element.kind}:${element.name ?? ''}`;
    return element.scope === undefined ? own : `${identityOf(element.scope)}>${own}`;
}

/**
 * Report that `element` designated nothing as a whole name, but would have
 * designated something as a substring. Returns whether a line was printed,
 * which is what the adapters' own tests assert on.
 */
export function warnSubstringOnly(element: ElementRef, where: string): boolean {
    const identity = identityOf(element);
    if (reported.has(identity)) {
        return false;
    }
    reported.add(identity);
    console.warn(
        `@jterrazz/test: ${element.kind}('${element.name ?? ''}') matched nothing as a whole ` +
            `accessible name, and matched only as a SUBSTRING of a longer one (${where}). ` +
            `Names are exact from 16.0: write the name in full, scope it with \`within(…)\`, ` +
            `or state \`{ exact: false }\` to keep the old behaviour. This warning ships for ` +
            `${WINDOW}; after that the substring match is gone and this is simply not found.`,
    );
    return true;
}

/** Forget what has been reported — the seam the adapters' tests reset between cases. */
export function resetSubstringWarnings(): void {
    reported.clear();
}
