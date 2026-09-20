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

/** How long the window lasts, stated in the message itself. */
const WINDOW = 'through 16.x';

/**
 * Where the line goes.
 *
 * NOT `console.warn`: vitest CAPTURES the console and its default reporter
 * prints nothing of what it captured, so a run that fired the warning showed
 * zero lines and the 17.0 deadline was unenforceable in a plain `npm test`.
 * The worker's own stderr is passed through instead, which is what a reader
 * sees without asking for a reporter.
 *
 * A printer is a parameter because one adapter is not on that side of the
 * seam: a mounted component runs IN the page, where there is no stderr, and it
 * hands the line back to the node side through `server.commands`.
 */
export type WindowPrinter = (line: string) => Promise<void> | void;

/** The node side's printer — the default every adapter but the page's uses. */
function toStandardError(line: string): void {
    if (typeof process === 'undefined') {
        // oxlint-disable-next-line eslint/no-console -- the last resort of a runtime with no stderr: a transitional notice that reaches nobody is the defect this printer exists to close
        console.warn(line);
        return;
    }
    process.stderr.write(`${line}\n`);
}

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
export async function warnSubstringOnly(
    element: ElementRef,
    where: string,
    found?: string,
    print: WindowPrinter = toStandardError,
): Promise<boolean> {
    const identity = identityOf(element);
    if (reported.has(identity)) {
        return false;
    }
    reported.add(identity);
    const spelling =
        found === undefined
            ? ''
            : ` The name to write is '${found.replaceAll(/\s+/gu, ' ').trim()}'.`;
    await print(
        `@jterrazz/test: ${element.kind}('${element.name ?? ''}') matched nothing as a whole ` +
            `accessible name, and matched only as a SUBSTRING of a longer one (${where}).` +
            `${spelling} Names are exact from 16.0: write the name in full, scope it with ` +
            `\`within(…)\`, or state \`{ exact: false }\` to keep the old behaviour. The substring ` +
            `is still resolved, with this warning, ${WINDOW}; gone in 17.0, where the same ` +
            `descriptor is simply not found.`,
    );
    return true;
}

/**
 * How long a descriptor is given to ARRIVE before the window concludes it is
 * absent — the budget `settles` spends and no more.
 *
 * A count is one observation, and a verb called right after a navigating
 * `click()` takes it on the page being LEFT. The window may not decide
 * "nothing matches this whole name" on that reading: the destination has not
 * been parsed yet. Long enough for a navigation to commit, far short of the
 * verb's own 30 s, and paid only when there is a substring to widen to.
 */
export const WINDOW_SETTLE_MS = 5000;

/**
 * What an adapter can ask of its own surface while the window lasts: how many
 * elements a descriptor designates right now, the whole name of the first one
 * — the spelling the author should be writing — and whether the descriptor
 * arrives if the surface is given a moment to settle.
 */
export type WindowProbe = {
    count: (element: ElementRef) => Promise<number>;
    nameOf: (element: ElementRef) => Promise<string | undefined>;
    /** Where a line goes; absent means the node side's own stderr. */
    print?: undefined | WindowPrinter;
    /** Does the descriptor designate something within {@link WINDOW_SETTLE_MS}? */
    settles: (element: ElementRef) => Promise<boolean>;
};

/**
 * The descriptor to retry with, LEVEL by level, or `undefined` when nothing
 * would change.
 *
 * Every level of the chain is asked the same question the target is asked —
 * `within(button('Proof of authorship'), content('Verified'))` against a
 * button named "Proof of authorship Verified" failed on the SCOPE, and a
 * warning that only ever widened the target printed nothing at all. The chain
 * is walked outside-in and rebuilt as it goes, since an inner level's answer
 * is meaningless under a scope that designates nothing.
 *
 * A level that states an `exact` of its own is left alone: an author who wrote
 * `{ exact: false }` chose the substring, and one who wrote `{ exact: true }`
 * was already exact.
 *
 * Asked BEFORE the action, not after it fails: a verb waits its whole
 * actionability budget, which is the test's own budget, so a retry afterwards
 * never runs — the test is already over. The common case (the name matches
 * whole) costs one count per level, which waits for nothing.
 */
export async function widenedForWindow(
    element: ElementRef,
    where: string,
    probe: WindowProbe,
): Promise<ElementRef | undefined> {
    const chain: ElementRef[] = [];
    for (let level: ElementRef | undefined = element; level; level = level.scope) {
        chain.unshift(level);
    }
    let rebuilt: ElementRef | undefined;
    let widened = false;
    /* oxlint-disable eslint/no-await-in-loop -- the chain is asked outside-in: an inner level's answer is meaningless under a scope that designates nothing, so the levels cannot be asked in parallel */
    for (const level of chain) {
        const candidate: ElementRef = {
            ...level,
            ...(rebuilt === undefined ? {} : { scope: rebuilt }),
        };
        const loose = await widenedLevel(candidate, where, probe);
        widened ||= loose !== undefined;
        rebuilt = loose ?? candidate;
    }
    /* oxlint-enable eslint/no-await-in-loop */
    return widened ? rebuilt : undefined;
}

/**
 * The one level, widened and warned about, or `undefined` when it designates
 * something already, states its own `exact`, carries no name, would designate
 * nothing either way, or turns out to be exact on the surface that ARRIVES.
 *
 * The last is the navigation case, and it is the reason the verdict is not two
 * counts: a `see()` fired right after a navigating `click()` counts the page
 * being left, so a descriptor that is perfectly exact on the DESTINATION read
 * as substring-only — non-deterministically, since which page each count
 * landed on was a race. A widening is therefore only decided once the exact
 * descriptor has been given the settle budget and still designates nothing.
 * The tell of the old fault was the printed name equalling the name written.
 */
async function widenedLevel(
    candidate: ElementRef,
    where: string,
    probe: WindowProbe,
): Promise<ElementRef | undefined> {
    if (candidate.exact !== undefined || candidate.name === undefined) {
        return undefined;
    }
    try {
        if ((await probe.count(candidate)) > 0) {
            return undefined;
        }
        const loose: ElementRef = { ...candidate, exact: false };
        // Exactly one, never "at least one": a substring that designates
        // Several is the ambiguity the old default hid, and the window may not
        // Resolve it by guessing which one the author meant (W3).
        if ((await probe.count(loose)) !== 1) {
            return undefined;
        }
        // Asked last, so the wait is paid only where there is something to
        // Widen to: an ordinary miss — a `gone()` on an absent element — is
        // Still two counts and no wait at all.
        if (!alreadyJudged(candidate) && (await probe.settles(candidate))) {
            return undefined;
        }
        await warnSubstringOnly(candidate, where, await probe.nameOf(loose), probe.print);
        return loose;
    } catch {
        // The surface is gone, or the looser match is ambiguous: neither is
        // This window's business, and neither may replace the failure the
        // Caller is already being handed.
        return undefined;
    }
}

/**
 * Has this descriptor already been judged substring-only in this run?
 *
 * The verdict is made once: a scenario that clicks the same link in ten tests
 * pays the settle budget on the first of them and is widened straight away on
 * the nine after it.
 */
function alreadyJudged(element: ElementRef): boolean {
    return reported.has(identityOf(element));
}

/** Forget what has been reported — the seam the adapters' tests reset between cases. */
export function resetSubstringWarnings(): void {
    reported.clear();
}
