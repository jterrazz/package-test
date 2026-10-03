import { describe, expect, test } from 'vitest';

import { noDocumentInGroundFindings } from './no-document-in-ground.js';

describe('noDocumentInGroundFindings', () => {
    test('a document under a ground folder is found, one beside its tests is not', () => {
        // Given - a document under _expected/, one under a folder only named like ground, and one in its leaf
        const found = [
            'widget/_expected/case.spec.yaml',
            'widget/expected/case.spec.yaml',
            'widget/case.spec.yaml',
        ].flatMap((file) => noDocumentInGroundFindings(file, 'case.spec.yaml'));

        // Then - the one under ground, told where it goes
        expect(found).toStrictEqual([
            {
                fix: 'move case.spec.yaml out of the ground folder, beside the test that runs it',
                found: 'a `.spec.yaml` document under a ground folder',
                line: 1,
                path: 'widget/_expected/case.spec.yaml',
                rule: 'no-document-in-ground',
            },
        ]);
    });
});
