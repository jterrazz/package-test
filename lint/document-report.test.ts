import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { silentLintFailures } from './document-report.js';

/** The repository root, from this module's place inside `lint/`. */
const ROOT = resolve(import.meta.dirname, '..');

/** A tree holding `files`, each with its content. */
function tree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'document-report-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

describe('silentLintFailures', () => {
    test('k10 — a lint-rule document goldens its report (meta-test) — no lint-rule document of this package asserts a failing exit with no report', () => {
        // Given - every lint-rule document of this package's own suite
        const silent = silentLintFailures(ROOT);

        // Then - each one that catches a rule shows what it caught
        expect(silent).toStrictEqual([]);
    });

    test('k10 — a lint-rule document goldens its report (meta-test) — names a document that pins a failing exit with neither stdout nor stderr golden', () => {
        // Given - one document that goldens nothing, one that goldens stderr, one that stays silent on a passing run, and one under a fixture tree a violation is fed through
        const root = tree({
            'specs/lint/c1-domain-structure/fixtures/violation/rejects.spec.yaml':
                'description: x\nruns:\n    - command: checker .\n      exit: 1\n',
            'specs/lint/c1-domain-structure/rejects-depth.spec.yaml':
                'description: x\nruns:\n    - command: checker .\n      exit: 1\n',
            'specs/lint/j2-no-sleep/accepts-a-double-that-settles.spec.yaml':
                'description: x\nruns:\n    - command: .\n      exit: 0\n',
            'specs/lint/j2-no-sleep/rejects-a-sleep.spec.yaml':
                'description: x\nruns:\n    - command: .\n      exit: 1\n      stderr: |\n          jterrazz-check(j2)\n',
        });

        // Then - only the document with neither channel golden is named
        expect(silentLintFailures(root)).toStrictEqual([
            'specs/lint/c1-domain-structure/rejects-depth.spec.yaml',
        ]);
    });
});
