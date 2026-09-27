import { sectionOf, writeSection } from '@jterrazz/typescript/rules';
import type { Counts } from '@jterrazz/typescript/rules';

export const BASELINE_SECTION = 'test';

// The run judges the routes it measured and records them here; the checker never counts them.
export const ROUTES_KEY = 'routes/unreached';

const heldOf = (root: string): Counts => sectionOf(root, BASELINE_SECTION) ?? {};

const withoutRoutes = (counts: Readonly<Counts>): Counts =>
    Object.fromEntries(Object.entries(counts).filter(([key]) => key !== ROUTES_KEY));

export function writeBaseline(root: string, counts: Readonly<Counts>): void {
    const held = heldOf(root)[ROUTES_KEY];
    writeSection(
        root,
        BASELINE_SECTION,
        held === undefined ? { ...counts } : { ...counts, [ROUTES_KEY]: held },
    );
}

export const heldUnreached = (root: string): number => heldOf(root)[ROUTES_KEY] ?? 0;

export function recordUnreached(root: string, count: number): void {
    const others = withoutRoutes(heldOf(root));
    writeSection(root, BASELINE_SECTION, count === 0 ? others : { ...others, [ROUTES_KEY]: count });
}
