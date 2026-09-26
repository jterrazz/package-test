import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { documentData, isFixture, specDocuments } from './spec-documents.js';

function treeWith(files: string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'spec-documents-'));
    for (const file of files) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), 'description: a case\n');
    }
    return root;
}

describe('specDocuments', () => {
    test('spec-documents — walks every spec document of a tree, sorted, and none a dependency or a build holds', () => {
        // Given - documents in the tree, beside one under node_modules/ and one under dist/
        const root = treeWith([
            'specs/cli/b/b.spec.yaml',
            'specs/cli/a/a.spec.yaml',
            'node_modules/pkg/specs/c.spec.yaml',
            'dist/d.spec.yaml',
            'specs/cli/a/notes.yaml',
        ]);

        // Then - the tree's own two, in order
        expect(specDocuments(root)).toStrictEqual([
            'specs/cli/a/a.spec.yaml',
            'specs/cli/b/b.spec.yaml',
        ]);
    });

    test('spec-documents — reads a document as the data it states, and a path under fixtures/ as an input', () => {
        // Given - a document and two paths
        // Then - the data is the plain object, and only the fixture path is an input
        expect(documentData('description: a case\nruns: []\n')).toStrictEqual({
            description: 'a case',
            runs: [],
        });
        expect([
            isFixture('specs/lint/x/fixtures/a.spec.yaml'),
            isFixture('specs/cli/a.spec.yaml'),
        ]).toStrictEqual([true, false]);
    });
});
