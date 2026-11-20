import { labelOf, sectionOf, writeSection } from '@jterrazz/typescript/rules';
import type { Counts } from '@jterrazz/typescript/rules';

import { TEST_SECTION } from '../project/test-section.js';

// invariant: the run judges the routes it measured and records them here; the checker never counts them.
const ROUTES_KEY = 'routes/unreached';

export const ROUTES_LEDGER = `${labelOf(TEST_SECTION)} › ${ROUTES_KEY}`;

const heldOf = (root: string): Counts => sectionOf(root, TEST_SECTION) ?? {};

const withoutRoutes = (counts: Readonly<Counts>): Counts =>
    Object.fromEntries(Object.entries(counts).filter(([key]) => key !== ROUTES_KEY));

export function writeBaseline(root: string, counts: Readonly<Counts>): void {
    const held = heldOf(root)[ROUTES_KEY];
    writeSection(
        root,
        TEST_SECTION,
        // Stryker disable next-line ConditionalExpression,ObjectLiteral: a key set to undefined is dropped when the section is written
        held === undefined ? { ...counts } : { ...counts, [ROUTES_KEY]: held },
    );
}

export const PIXELS_KEY = 'pixel-goldens/bytes';

export const PIXELS_LEDGER = `${labelOf(TEST_SECTION)} › ${PIXELS_KEY}`;

export const heldPixelBytes = (root: string): number | undefined => heldOf(root)[PIXELS_KEY];

/** A measured key holds a quantity the checker reads off the tree, not a count of findings: a fix lowers it to where the tree stands, and only a recording raises it. */
export function lowerMeasured(root: string, measured: Readonly<Counts>): string[] {
    const held = heldOf(root);
    const fallen = new Map(Object.entries(measured).filter(([key, now]) => now < (held[key] ?? 0)));
    if (fallen.size === 0) {
        return [];
    }
    writeSection(
        root,
        TEST_SECTION,
        Object.fromEntries(
            Object.entries(held).flatMap(([key, count]): [string, number][] => {
                const next = fallen.get(key) ?? count;
                return next > 0 ? [[key, next]] : [];
            }),
        ),
    );
    return [...fallen].map(
        ([key, now]) =>
            `re-recorded ${labelOf(TEST_SECTION)} › ${key} from ${String(held[key])} to ${String(now)}`,
    );
}

export const heldUnreached = (root: string): number => heldOf(root)[ROUTES_KEY] ?? 0;

export function recordUnreached(root: string, count: number): void {
    const others = withoutRoutes(heldOf(root));
    writeSection(root, TEST_SECTION, count === 0 ? others : { ...others, [ROUTES_KEY]: count });
}
