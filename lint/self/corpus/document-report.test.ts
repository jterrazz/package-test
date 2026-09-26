import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { silentLintFailures } from './document-report.js';

const ROOT = resolve(import.meta.dirname, '../../..');

function tree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'document-report-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

describe('silentLintFailures', () => {
    test('`lint-document-goldens-the-report` — a lint-rule document goldens its report (meta-test) — no lint-rule document of this package asserts a failing exit with no report', () => {
        // Given - every lint-rule document of this package's own suite
        const silent = silentLintFailures(ROOT);

        // Then - each one that catches a rule shows what it caught
        expect(silent).toStrictEqual([]);
    });

    test('`lint-document-goldens-the-report` — a lint-rule document goldens its report (meta-test) — names a document that pins a failing exit with neither stdout nor stderr golden', () => {
        // Given - one document that goldens nothing, one that goldens stderr, one that stays silent on a passing run, and one under a fixture tree a violation is fed through
        const root = tree({
            'specs/lint/specs-at-declared-depth/_fixtures/violation/rejects.spec.yaml':
                'description: x\nruns:\n    - command: checker .\n      exit: 1\n',
            'specs/lint/specs-at-declared-depth/rejects-depth.spec.yaml':
                'description: x\nruns:\n    - command: checker .\n      exit: 1\n',
            'specs/lint/no-sleep/accepts-a-double-that-settles.spec.yaml':
                'description: x\nruns:\n    - command: .\n      exit: 0\n',
            'specs/lint/no-sleep/rejects-a-sleep.spec.yaml':
                'description: x\nruns:\n    - command: .\n      exit: 1\n      stderr: |\n          jterrazz-check(no-sleep)\n',
        });

        // Then - only the document with neither channel golden is named
        expect(silentLintFailures(root)).toStrictEqual([
            'specs/lint/specs-at-declared-depth/rejects-depth.spec.yaml',
        ]);
    });
});
