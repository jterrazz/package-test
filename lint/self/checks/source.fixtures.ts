import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { Finding } from '../../checks/checker.js';
import type { SelfPassId } from './checker.js';

export const ROOT = resolve(import.meta.dirname, '../../..');

export function treeOf(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'self-source-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

export function located(findings: Finding<SelfPassId>[]): string[] {
    return findings.map(
        ({ column, file, found, line, rule }) => `${file}:${line}:${column ?? 1} ${rule}: ${found}`,
    );
}
