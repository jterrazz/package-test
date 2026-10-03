import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../checker-cli.specification.js';

describe('document-format', () => {
    test('refuses a document whose runs sit above its env', async () => {
        // Given - a document declaring runs: before env:
        const result = await cli
            .fixture(directory('./_fixtures/document-format/keys-out-of-order/'))
            .exec('.');

        // Then - the formatter names the document, and the run fails with nothing held
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            found: \`specs/widget/builds.spec.yaml\`, a spec document out of its format · why: one key order and block-scalar streams make every document read and diff alike, and the formatter writes them · fix: run 'typescript fix', which orders its keys and writes its streams as block scalars · read: docs/15-documents.md#the-schema-and-the-format
        `);
    });

    test('refuses a stream written as a quoted string', async () => {
        // Given - a stdout: spelled with backslash-n escapes
        const result = await cli
            .fixture(directory('./_fixtures/document-format/stream-quoted/'))
            .exec('.');

        // Then - the formatter names the document
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            found: \`specs/widget/builds.spec.yaml\`, a spec document out of its format · why: one key order and block-scalar streams make every document read and diff alike, and the formatter writes them · fix: run 'typescript fix', which orders its keys and writes its streams as block scalars · read: docs/15-documents.md#the-schema-and-the-format
        `);
    });

    test('writes the document in its format under --fix, and the run passes', async () => {
        // Given - the document whose runs sit above its env
        const result = await cli
            .fixture(directory('./_fixtures/document-format/keys-out-of-order/'))
            .exec('. --fix');

        // Then - the keys stand in the canonical order, and nothing is refused
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            conventions checker: rewrote 1 spec document(s)
            jterrazz.baseline.json › test: nothing held
        `);
        expect(result.file('specs/widget/builds.spec.yaml').content).toBe(
            [
                'description: meets the session before its setup',
                'env:',
                '    - frozen',
                'runs:',
                '    - command: widget build',
                '      exit: 0',
                '      stdout: |',
                '          Built.',
                '',
            ].join('\n'),
        );
    });

    test('accepts a document in its format', async () => {
        // Given - the compliant twin every document pass shares
        const result = await cli
            .fixture(directory('../../_shared/_fixtures/spec-document-ok/'))
            .exec('.');

        // Then - the clean summary on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./_expected/clean.txt'));
    });
});
