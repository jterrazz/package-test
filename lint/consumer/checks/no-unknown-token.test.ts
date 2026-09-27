import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { Finding } from '../../engine/checker/finding.js';
import { checkerLine, runTree } from '../../engine/checker/tree-run.js';
import { CHECKER } from './checker.js';

const FIXTURES = resolve(
    import.meta.dirname,
    '../../../specs/lint/checker/_fixtures/lint-violations',
);

function groundFindings(root: string): Finding[] {
    return runTree(root, CHECKER).filter(({ rule }) => rule === 'no-unknown-token');
}

describe('noUnknownTokenFindings', () => {
    test('ground-walk — ground-files — the ground walk (`no-unknown-token`) — walks a specs tree and reports unknown tokens in fixture files', () => {
        // Given - the violation fixture tree ({{userid}} in _expected/out.txt)
        const violations = groundFindings(resolve(FIXTURES, 'no-unknown-token'));

        // Then - the finding names the relative file, line and token
        expect(violations).toStrictEqual([
            expect.objectContaining({
                file: 'specs/widget/_expected/out.txt',
                line: 1,
                token: '{{userid}}',
            }),
        ]);

        // Then - the rendering carries file, token and the known vocabulary
        const rendered = violations.map((violation) => checkerLine(CHECKER, violation)).join('\n');
        expect(rendered).toContain('specs/widget/_expected/out.txt:1');
        expect(rendered).toContain('{{userid}}');
        expect(rendered).toContain('uuid');
    });

    test('ground-walk — ground-files — the ground walk (`no-unknown-token`) — passes the compliant twin', () => {
        // Given - the -ok tree (only known tokens)
        const violations = groundFindings(resolve(FIXTURES, 'no-unknown-token-ok'));

        // Then - clean
        expect(violations).toStrictEqual([]);
    });
});
