import { describe, expect, test } from 'vitest';

import { specsTree } from '../../kit/testing/subject.fixtures.js';
import { checkFacetFolderHasSpecification } from './facet-folder-has-specification.js';

describe('checkFacetFolderHasSpecification', () => {
    test('a facet folder is found when no specification beside it constructs its own facet', () => {
        // Given - an api folder constructing its runner, a cli folder whose specification constructs another facet, a job folder with none, and a folder that is no facet
        const root = specsTree({
            'api/api.specification.ts': 'export const { api } = await specification.api({});\n',
            'api/notes.ts': 'specification.api(\n',
            'cli/cli.specification.ts': 'export const { api } = await specification.api({});\n',
            'helpers/helpers.specification.ts': 'export {};\n',
            'job/run.spec.ts': 'specification.job(\n',
        });

        // Then - the cli and job folders, each told the specification to create
        expect(
            checkFacetFolderHasSpecification(root).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'facet-folder-has-specification cli:1 `specs/cli/`, a facet folder with no specification constructing `specification.cli()` — create `specs/cli/cli.specification.ts` calling `specification.cli()`, or rename the folder',
            'facet-folder-has-specification job:1 `specs/job/`, a facet folder with no specification constructing `specification.job()` — create `specs/job/job.specification.ts` calling `specification.job()`, or rename the folder',
        ]);
    });
});
