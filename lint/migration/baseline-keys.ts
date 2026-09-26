import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CHECKER_NAMESPACE } from '../checks/checker.js';
import { BASELINE_FILE, keepsBaseline, readBaseline, writeBaseline } from '../ratchet/baseline.js';
import { PASS_NAMES, RULE_NAMES } from './names.js';

export type BaselineKeysMove = {
    file: string;
    renamed: string[];
    /** A code several passes shared counts them together, and no count splits back into them. */
    shared: string[];
};

/** The typescript toolchain moves these into `jterrazz.baseline.json` after this pass, keys as they are. */
const LEGACY_FILES = ['oxlint.baseline.json', 'test.baseline.json'];

type Renamed = Omit<BaselineKeysMove, 'file'> & { counts: Record<string, number> };

function nameOf(key: string): readonly string[] | string | undefined {
    if (key.startsWith('jterrazz/')) {
        return RULE_NAMES[key.slice('jterrazz/'.length)];
    }
    if (key.startsWith(`${CHECKER_NAMESPACE}/`)) {
        return PASS_NAMES[key.slice(CHECKER_NAMESPACE.length + 1)];
    }
    return undefined;
}

function renamedKeys(held: Readonly<Record<string, number>>): Renamed {
    const counts: Record<string, number> = {};
    const renamed: string[] = [];
    const shared: string[] = [];
    for (const [key, count] of Object.entries(held)) {
        const names = nameOf(key);
        const name = typeof names === 'string' ? names : names?.length === 1 ? names[0] : undefined;
        if (names !== undefined && name === undefined) {
            shared.push(key);
        }
        const next = name === undefined ? key : `${key.slice(0, key.indexOf('/'))}/${name}`;
        if (next !== key) {
            renamed.push(key);
        }
        counts[next] = (counts[next] ?? 0) + count;
    }
    return { counts, renamed, shared };
}

function flatCounts(path: string): Record<string, number> | undefined {
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return undefined;
        }
        return Object.fromEntries(
            Object.entries(parsed).filter(
                (entry): entry is [string, number] => typeof entry[1] === 'number',
            ),
        );
    } catch {
        return undefined;
    }
}

export function migrateBaselineKeys(dir: string): BaselineKeysMove[] {
    const moves: BaselineKeysMove[] = [];
    if (existsSync(join(dir, BASELINE_FILE)) && keepsBaseline(dir)) {
        const { counts, renamed, shared } = renamedKeys(readBaseline(dir));
        if (renamed.length > 0) {
            writeBaseline(dir, counts);
        }
        if (renamed.length > 0 || shared.length > 0) {
            moves.push({ file: BASELINE_FILE, renamed, shared });
        }
    }
    for (const file of LEGACY_FILES) {
        const path = join(dir, file);
        const held = existsSync(path) ? flatCounts(path) : undefined;
        if (held === undefined) {
            continue;
        }
        const { counts, renamed, shared } = renamedKeys(held);
        if (renamed.length > 0) {
            writeFileSync(path, `${JSON.stringify(counts, null, 4)}\n`);
        }
        if (renamed.length > 0 || shared.length > 0) {
            moves.push({ file, renamed, shared });
        }
    }
    return moves;
}
