import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROUTES_KEY } from '../../../../lint/engine/baseline/ratchet.js';

/* `ROUTES_KEY` is the run's; the checker reads and writes the rest of that section. */

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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
