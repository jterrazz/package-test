import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * The route ratchet: the count of declared routes no request reached, held in
 * `jterrazz.baseline.json › test` under {@link ROUTES_KEY}. The checker reads
 * and writes that section too, and leaves this key to the run.
 */

/** A plain object — never an array, never null. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The ratchet key the run owns in the `test` section — the unreached routes it holds. */
export const ROUTES_KEY = 'routes/unreached';

/** The unreached routes the project's ratchet holds — 0 when it holds none. */
export function heldUnreached(root: string): number {
    const path = join(root, 'jterrazz.baseline.json');
    if (!existsSync(path)) {
        return 0;
    }
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const test = isRecord(parsed) ? parsed.test : undefined;
    const held = isRecord(test) ? test[ROUTES_KEY] : undefined;
    return typeof held === 'number' ? held : 0;
}

/**
 * Record `count` as the unreached routes the ratchet holds, in the `test`
 * section of `jterrazz.baseline.json` — every other key kept, the entry
 * removed at zero.
 */
export function recordUnreached(root: string, count: number): void {
    const path = join(root, 'jterrazz.baseline.json');
    const parsed: unknown = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    const file = isRecord(parsed) ? parsed : {};
    const others = Object.entries(isRecord(file.test) ? file.test : {}).filter(
        ([key]) => key !== ROUTES_KEY,
    );
    const test = Object.fromEntries(count === 0 ? others : [...others, [ROUTES_KEY, count]]);
    const sorted = Object.fromEntries(
        Object.entries(test).toSorted(([a], [b]) => (a < b ? -1 : 1)),
    );
    writeFileSync(path, `${JSON.stringify({ ...file, test: sorted }, null, 4)}\n`);
}
