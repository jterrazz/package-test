import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('setup-module-at-lowest-common-folder', () => {
    test("modules at their readers' lowest folder pass, and one no module imports is left to knip", async () => {
        // Given - the lowest tree
        const result = await checker.fixture(directory('./__fixtures__/lowest/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test("--fix moves a module to its readers' lowest folder, _shared/ across specifications, and the imports with it", async () => {
        // Given - the misplaced tree
        const result = await checker
            .fixture(directory('./__fixtures__/misplaced/'))
            .run({ fix: true });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/__setup__/format.ts:1:1  jterrazz-check(setup-module-at-lowest-common-folder)
                found: \`specs/cli/__setup__/format.ts\`, read by \`listing.spec.ts\` alone
                why: A \`__setup__/\` module sits in the \`__setup__/\` of the LOWEST folder every module importing it shares — the law ground follows (\`ground-shared-or-inline\`), read on imports: a reader is any module of the tree importing it by a relative path or a \`package.json\` \`imports\` alias, and a reader inside a \`__setup__/\` counts as the folder that \`__setup__/\` belongs to.
                fix: write what it holds in \`specs/cli/orders/listing.spec.ts\`, and delete the module — a \`__setup__/\` module exists only while several read it
                read: docs/reference/linting.md#setup-module-at-lowest-common-folder
            specs/cli/__setup__/labels.ts:1:1  jterrazz-check(setup-module-at-lowest-common-folder)
                found: \`specs/cli/__setup__/labels.ts\`, whose readers share \`specs/cli/orders/\`, not \`specs/cli/\`
                why: A \`__setup__/\` module sits in the \`__setup__/\` of the LOWEST folder every module importing it shares — the law ground follows (\`ground-shared-or-inline\`), read on imports: a reader is any module of the tree importing it by a relative path or a \`package.json\` \`imports\` alias, and a reader inside a \`__setup__/\` counts as the folder that \`__setup__/\` belongs to.
                fix: move it to \`specs/cli/orders/__setup__/labels.ts\` — the \`__setup__/\` of the lowest folder its readers share — and the \`imports\` alias that reaches it, by hand: \`typescript fix\` moves no module an alias reaches
                read: docs/reference/linting.md#setup-module-at-lowest-common-folder
        `);
        await expect(result.directory()).toMatch(directory('./__expected__/misplaced/'));
    });

    test('a setup module one spec reads, one kept above its readers and one kept below them are refused', async () => {
        // Given - the misplaced tree
        const result = await checker.fixture(directory('./__fixtures__/misplaced/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/__setup__/format.ts:1:1  jterrazz-check(setup-module-at-lowest-common-folder)
                found: \`specs/cli/__setup__/format.ts\`, read by \`listing.spec.ts\` alone
                why: A \`__setup__/\` module sits in the \`__setup__/\` of the LOWEST folder every module importing it shares — the law ground follows (\`ground-shared-or-inline\`), read on imports: a reader is any module of the tree importing it by a relative path or a \`package.json\` \`imports\` alias, and a reader inside a \`__setup__/\` counts as the folder that \`__setup__/\` belongs to.
                fix: write what it holds in \`specs/cli/orders/listing.spec.ts\`, and delete the module — a \`__setup__/\` module exists only while several read it
                read: docs/reference/linting.md#setup-module-at-lowest-common-folder
            specs/cli/__setup__/labels.ts:1:1  jterrazz-check(setup-module-at-lowest-common-folder)
                found: \`specs/cli/__setup__/labels.ts\`, whose readers share \`specs/cli/orders/\`, not \`specs/cli/\`
                why: A \`__setup__/\` module sits in the \`__setup__/\` of the LOWEST folder every module importing it shares — the law ground follows (\`ground-shared-or-inline\`), read on imports: a reader is any module of the tree importing it by a relative path or a \`package.json\` \`imports\` alias, and a reader inside a \`__setup__/\` counts as the folder that \`__setup__/\` belongs to.
                fix: move it to \`specs/cli/orders/__setup__/labels.ts\` — the \`__setup__/\` of the lowest folder its readers share — and the \`imports\` alias that reaches it, by hand: \`typescript fix\` moves no module an alias reaches
                read: docs/reference/linting.md#setup-module-at-lowest-common-folder
            specs/cli/__setup__/rows.ts:1:1  jterrazz-check(setup-module-at-lowest-common-folder)
                found: \`specs/cli/__setup__/rows.ts\`, whose readers share \`specs/cli/orders/\`, not \`specs/cli/\`
                why: A \`__setup__/\` module sits in the \`__setup__/\` of the LOWEST folder every module importing it shares — the law ground follows (\`ground-shared-or-inline\`), read on imports: a reader is any module of the tree importing it by a relative path or a \`package.json\` \`imports\` alias, and a reader inside a \`__setup__/\` counts as the folder that \`__setup__/\` belongs to.
                fix: move it to \`specs/cli/orders/__setup__/rows.ts\` — the \`__setup__/\` of the lowest folder its readers share — and the paths that import it; \`typescript fix\` does both
                read: docs/reference/linting.md#setup-module-at-lowest-common-folder
            specs/cli/__setup__/tenant.ts:1:1  jterrazz-check(setup-module-at-lowest-common-folder)
                found: \`specs/cli/__setup__/tenant.ts\`, whose readers share \`specs/\`, not \`specs/cli/\`
                why: A \`__setup__/\` module sits in the \`__setup__/\` of the LOWEST folder every module importing it shares — the law ground follows (\`ground-shared-or-inline\`), read on imports: a reader is any module of the tree importing it by a relative path or a \`package.json\` \`imports\` alias, and a reader inside a \`__setup__/\` counts as the folder that \`__setup__/\` belongs to.
                fix: move it to \`specs/__setup__/tenant.ts\` — the \`__setup__/\` of the lowest folder its readers share — and the paths that import it; \`typescript fix\` does both
                read: docs/reference/linting.md#setup-module-at-lowest-common-folder
            specs/cli/orders/__setup__/clock.ts:1:1  jterrazz-check(setup-module-at-lowest-common-folder)
                found: \`specs/cli/orders/__setup__/clock.ts\`, whose readers share \`specs/cli/\`, not \`specs/cli/orders/\`
                why: A \`__setup__/\` module sits in the \`__setup__/\` of the LOWEST folder every module importing it shares — the law ground follows (\`ground-shared-or-inline\`), read on imports: a reader is any module of the tree importing it by a relative path or a \`package.json\` \`imports\` alias, and a reader inside a \`__setup__/\` counts as the folder that \`__setup__/\` belongs to.
                fix: move it to \`specs/cli/__setup__/clock.ts\` — the \`__setup__/\` of the lowest folder its readers share — and the paths that import it; \`typescript fix\` does both
                read: docs/reference/linting.md#setup-module-at-lowest-common-folder
        `);
    });
});
