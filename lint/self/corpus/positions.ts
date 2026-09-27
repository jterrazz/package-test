import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Row } from '../../engine/catalogue/row.js';

const STATIC_CHANNELS: ReadonlySet<string> = new Set(['checker', 'statique']);

const RULE_ROOTS = ['lint/consumer/rules', 'lint/self/rules'];

function filesUnder(dir: string): string[] {
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name));
}

function reportedAt(name: string): RegExp {
    return new RegExp(
        String.raw`:\d+:\d+:?\s+(?:error )?jterrazz(?:-check|-self)?\(${name}\)`,
        'u',
    );
}

function goldens(root: string, name: string): string[] {
    return [
        ...filesUnder(join(root, 'specs/lint', name)),
        join(root, 'specs/lint/checker', `${name}.test.ts`),
    ].filter((path) => existsSync(path) && !path.includes('/_fixtures/'));
}

function ruleTests(root: string, name: string): string[] {
    return RULE_ROOTS.flatMap((dir) => filesUnder(join(root, dir))).filter((path) =>
        path.endsWith(`/${name}.test.ts`),
    );
}

function provesItsPosition(root: string, name: string): boolean {
    const reported = reportedAt(name);
    return (
        goldens(root, name).some((path) => reported.test(readFileSync(path, 'utf8'))) ||
        ruleTests(root, name).some((path) => /\bline:\s*\d+/u.test(readFileSync(path, 'utf8')))
    );
}

export function unpositionedRules(root: string, rows: readonly Row[]): string[] {
    return rows
        .filter((row) => STATIC_CHANNELS.has(row.channel) && !provesItsPosition(root, row.name))
        .map((row) => row.name);
}
