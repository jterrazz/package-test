import { labelOf, sectionOf, writeSection } from '@jterrazz/typescript/rules';
import type { Counts } from '@jterrazz/typescript/rules';

import { TEST_SECTION } from '../project/test-section.js';

// invariant: the run judges the routes it measured and records them here; the checker never counts them.
export const ROUTES_KEY = 'routes/unreached';

export const ROUTES_LEDGER = `${labelOf(TEST_SECTION)} › ${ROUTES_KEY}`;

const heldOf = (root: string): Counts => sectionOf(root, TEST_SECTION) ?? {};

const withoutRoutes = (counts: Readonly<Counts>): Counts =>
    Object.fromEntries(Object.entries(counts).filter(([key]) => key !== ROUTES_KEY));

export function writeBaseline(root: string, counts: Readonly<Counts>): void {
    const held = heldOf(root)[ROUTES_KEY];
    writeSection(
        root,
        TEST_SECTION,
        held === undefined ? { ...counts } : { ...counts, [ROUTES_KEY]: held },
    );
}

export const heldUnreached = (root: string): number => heldOf(root)[ROUTES_KEY] ?? 0;

export function recordUnreached(root: string, count: number): void {
    const others = withoutRoutes(heldOf(root));
    writeSection(root, TEST_SECTION, count === 0 ? others : { ...others, [ROUTES_KEY]: count });
}
