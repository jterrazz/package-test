import { originalOf } from '@jterrazz/typescript/rules';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { Spotted } from '../../../kit/checker/registry.js';

export const ROOT = originalOf(resolve(import.meta.dirname, '../../../..'));

export function treeOf(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'self-source-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

export function located(findings: Spotted[]): string[] {
    return findings.map(
        ({ column, found, line, path, rule }) => `${path}:${line}:${column ?? 1} ${rule}: ${found}`,
    );
}
