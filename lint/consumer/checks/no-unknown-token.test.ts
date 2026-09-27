import { reportLine } from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { Spotted } from '../../engine/checker/registry.js';
import { teacherOf } from '../../engine/checker/teacher.js';
import { CHECKER } from './checker.js';

const FIXTURES = resolve(import.meta.dirname, '../../../specs/lint/no-unknown-token/_fixtures');

function groundFindings(root: string): Spotted[] {
    return CHECKER.tree
        .flatMap((pass) => pass(root))
        .filter(({ rule }) => rule === 'no-unknown-token');
}

describe('noUnknownTokenFindings', () => {
    test('ground-walk — ground-files — the ground walk (`no-unknown-token`) — walks a specs tree and reports unknown tokens in fixture files', () => {
        // Given - the violation fixture tree ({{userid}} in _expected/out.txt)
        const violations = groundFindings(resolve(FIXTURES, 'no-unknown-token'));

        // Then - the finding names the relative file, line and token
        expect(violations).toStrictEqual([
            expect.objectContaining({
                line: 1,
                path: 'specs/widget/_expected/out.txt',
            }),
        ]);

        // Then - the rendering carries file, token and the known vocabulary
        const rendered = teacherOf(CHECKER)(violations)
            .map((violation) => reportLine(violation))
            .join('\n');
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
