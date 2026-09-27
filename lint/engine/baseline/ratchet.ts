import {
    judgeExact,
    keepsSection,
    labelOf,
    refusal,
    sectionOf,
    writeSection,
} from '@jterrazz/typescript/rules';
import type { Counts, Ratchet } from '@jterrazz/typescript/rules';

export const BASELINE_SECTION = 'test';

export const BASELINE_LABEL = labelOf(BASELINE_SECTION);

// The run judges the routes it measured and records them here; the checker never counts them.
export const ROUTES_KEY = 'routes/unreached';

const RATCHET: Ratchet = {
    lower: 'jterrazz-test-check --fix',
    record: 'jterrazz-test-check baseline',
};

/** `jterrazz-check(no-unused-ground)` → `jterrazz-check/no-unused-ground`. */
export function keyOf(printedRule: string): string {
    const match = /^(?<plugin>[\w-]+)\((?<rule>[^)]+)\)$/u.exec(printedRule);
    return match?.groups === undefined
        ? printedRule
        : `${match.groups.plugin}/${match.groups.rule}`;
}

export function countsOf(printedRules: readonly string[]): Counts {
    const counts: Counts = {};
    for (const printedRule of printedRules) {
        const key = keyOf(printedRule);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

const withoutRoutes = (counts: Readonly<Counts>): Counts =>
    Object.fromEntries(Object.entries(counts).filter(([key]) => key !== ROUTES_KEY));

export function judge(counts: Readonly<Counts>, recorded: Readonly<Counts>): string[] {
    return judgeExact({ ...counts }, withoutRoutes(recorded), RATCHET).map(({ teaching }) =>
        refusal({
            ...teaching,
            read: 'docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson',
        }),
    );
}

export const ownsKey = (key: string): boolean => key !== ROUTES_KEY;

export const keepsBaseline = (root: string): boolean => keepsSection(root, BASELINE_SECTION);

export const readBaseline = (root: string): Counts => sectionOf(root, BASELINE_SECTION) ?? {};

export function writeBaseline(root: string, counts: Readonly<Counts>): void {
    const held = readBaseline(root)[ROUTES_KEY];
    writeSection(
        root,
        BASELINE_SECTION,
        held === undefined ? { ...counts } : { ...counts, [ROUTES_KEY]: held },
    );
}

export const heldUnreached = (root: string): number => readBaseline(root)[ROUTES_KEY] ?? 0;

export function recordUnreached(root: string, count: number): void {
    const others = withoutRoutes(readBaseline(root));
    writeSection(root, BASELINE_SECTION, count === 0 ? others : { ...others, [ROUTES_KEY]: count });
}
