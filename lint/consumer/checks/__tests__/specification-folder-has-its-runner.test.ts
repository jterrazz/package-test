import { describe, expect, test } from 'vitest';

import { specsTree } from '../../../__tests__/subject.fixtures.js';
import { checkSpecificationFolderHasItsRunner } from '../specification-folder-has-its-runner.js';

describe('checkSpecificationFolderHasItsRunner', () => {
    test('a specification folder is found when no specification beside it constructs its own specification', () => {
        // Given - an api folder constructing its runner, a cli folder whose specification constructs another specification, a job folder with none, and a folder that is no specification
        const root = specsTree({
            'api/api.specification.ts': 'export const { api } = await specification.api({});\n',
            'api/notes.ts': 'specification.api(\n',
            'cli/cli.specification.ts': 'export const { api } = await specification.api({});\n',
            'helpers/helpers.specification.ts': 'export {};\n',
            'job/run.spec.ts': 'specification.job(\n',
        });

        // Then - the cli and job folders, each told the specification to create
        expect(
            checkSpecificationFolderHasItsRunner(root).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'specification-folder-has-its-runner cli:1 `specs/cli/`, a specification folder with no runner constructing `specification.cli()` — create `specs/cli/cli.specification.ts` calling `specification.cli()`, or rename the folder',
            'specification-folder-has-its-runner job:1 `specs/job/`, a specification folder with no runner constructing `specification.job()` — create `specs/job/job.specification.ts` calling `specification.job()`, or rename the folder',
        ]);
    });
});
