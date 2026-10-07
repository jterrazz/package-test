import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import { checkDocumentDescriptionUnique } from '../document-description-unique.js';

const documentDescribed = (description: string): string =>
    `description: ${description}\nruns:\n    - command: a\n      exit: 0\n`;

describe('checkDocumentDescriptionUnique', () => {
    test('a description another document of the same folder already holds is found on the later one', () => {
        // Given - two documents of one folder sharing a description, a third elsewhere sharing it too, and one that does not parse
        const root = packageWith({
            'specs/cli/build/a.spec.yaml': documentDescribed('builds the project'),
            'specs/cli/build/b.spec.yaml': documentDescribed('builds the project'),
            'specs/cli/build/c.spec.yaml': 'runs: [\n',
            'specs/cli/build/d.spec.yaml': documentDescribed('builds it twice'),
            'specs/cli/check/a.spec.yaml': documentDescribed('builds the project'),
        });

        // Then - the later document of the folder, naming the first
        expect(
            checkDocumentDescriptionUnique(root).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'document-description-unique specs/cli/build/b.spec.yaml:1 "builds the project", already the description of specs/cli/build/a.spec.yaml — retitle one of the two for what it proves apart from the other',
        ]);
    });
});
