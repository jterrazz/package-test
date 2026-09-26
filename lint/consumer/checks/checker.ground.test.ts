import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkGroundAndDocuments } from './checker.ground.js';
import { checkerLines } from './checker.js';

const FIXTURES = resolve(
    import.meta.dirname,
    '../../../specs/lint/checker/fixtures/lint-violations',
);

describe('checkGroundAndDocuments', () => {
    test('ground-files — checkGroundAndDocuments (`no-unknown-token`) — walks a specs tree and reports unknown tokens in fixture files', () => {
        // Given - the violation fixture tree ({{userid}} in expected/out.txt)
        const violations = checkGroundAndDocuments(resolve(FIXTURES, 'no-unknown-token'));

        // Then - the finding names the relative file, line, token and severity
        expect(violations).toStrictEqual([
            expect.objectContaining({
                file: 'specs/widget/expected/out.txt',
                line: 1,
                severity: 'error',
                token: '{{userid}}',
            }),
        ]);

        // Then - the rendering carries file, token and the known vocabulary
        const rendered = checkerLines(violations);
        expect(rendered).toContain('specs/widget/expected/out.txt:1');
        expect(rendered).toContain('{{userid}}');
        expect(rendered).toContain('uuid');
    });

    test('ground-files — checkGroundAndDocuments (`no-unknown-token`) — passes the compliant twin', () => {
        // Given - the -ok tree (only known tokens)
        const violations = checkGroundAndDocuments(resolve(FIXTURES, 'no-unknown-token-ok'));

        // Then - clean
        expect(violations).toStrictEqual([]);
    });
});
