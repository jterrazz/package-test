import { describe, expect, test } from 'vitest';

import { specsAnchor } from './ast.js';
import { identityOf, isProductionFile, segmentsOf, specsAnchorOf } from './linted-file.js';
import type { LintedFile } from './linted-file.js';
import { isProductionModule } from './production.js';
import { projectSegments, roleOf } from './role.js';

/** A file as a rule's context hands it: its name, and the source object of its lint. */
const linted = (physicalFilename: string, sourceCode: object = {}): LintedFile => ({
    physicalFilename,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the answers key on the object's identity and read nothing of it
    sourceCode: sourceCode as LintedFile['sourceCode'],
});

describe('linted-file — what every rule asks, answered once per file', () => {
    test('the answers are the ones the path functions give', () => {
        // Given - a spec under a specs tree
        const path = '/repo/specs/api/users/creation.spec.ts';
        const file = linted(path);

        // Then - each answer is its function's, read from the file's name
        expect(identityOf(file)).toStrictEqual(roleOf(path));
        expect(isProductionFile(file)).toBe(isProductionModule(path));
        expect(specsAnchorOf(file)).toStrictEqual(specsAnchor(path));
        expect(segmentsOf(file)).toStrictEqual(projectSegments(path));
    });

    test('a second rule asking about the same lint gets the answer the first one read', () => {
        // Given - one file's lint, asked twice
        const file = linted('/repo/specs/api/users/creation.spec.ts');
        const first = identityOf(file);

        // Then - the same object: the walk up the tree ran once
        expect(identityOf(file)).toBe(first);
    });

    test('another lint, or another file, is answered afresh', () => {
        // Given - one lint's answer
        const sourceCode = {};
        const first = identityOf(linted('/repo/specs/api/users/creation.spec.ts', sourceCode));

        // Then - a new lint of the same file reads again, and so does another file on the same key
        expect(identityOf(linted('/repo/specs/api/users/creation.spec.ts'))).not.toBe(first);
        expect(identityOf(linted('/repo/src/users/create.ts', sourceCode)).role).toBe('other');
    });
});
