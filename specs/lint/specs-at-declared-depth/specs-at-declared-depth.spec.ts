import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('specs-at-declared-depth', () => {
    test('tests at facet/domain depth and a ground module beside its test pass', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a test at the facet root, one in ground with no module beside it, and one under _shared/ are refused', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/_shared/listed/listed.test.ts:1:1  jterrazz(specs-at-declared-depth)
                found: a spec under \`specs/_shared/\`, what several facets share
                why: A specs tree DECLARES its shape through the \`depth\` option: \`facet-domain\` (the default — a test at facet/domain depth), \`facet\` (a test at the facet root OR one domain folder down, never deeper), \`mirror\` (a test at any depth ≥ 1, named after its directory), \`off\`.
                fix: move it into its facet: \`specs/_shared/\` holds only \`_setup/\`, \`_fixtures/\`, \`_seeds/\`, \`_requests/\` and \`_expected/\`
                read: docs/19-linting.md#specs-at-declared-depth
            specs/widget/_fixtures/binary/scenarios.test.ts:1:1  jterrazz(specs-at-declared-depth)
                found: a spec under \`_fixtures/\`, a reserved folder that is no subject
                why: A specs tree DECLARES its shape through the \`depth\` option: \`facet-domain\` (the default — a test at facet/domain depth), \`facet\` (a test at the facet root OR one domain folder down, never deeper), \`mirror\` (a test at any depth ≥ 1, named after its directory), \`off\`.
                fix: move the spec out of \`_fixtures/\`, into the subject folder it specifies; a reserved folder that is code keeps only a \`<module>.test.ts\` next to its \`<module>.ts\`
                read: docs/19-linting.md#specs-at-declared-depth
            specs/widget/widget.test.ts:1:1  jterrazz(specs-at-declared-depth)
                found: a spec directly at its facet root
                why: A specs tree DECLARES its shape through the \`depth\` option: \`facet-domain\` (the default — a test at facet/domain depth), \`facet\` (a test at the facet root OR one domain folder down, never deeper), \`mirror\` (a test at any depth ≥ 1, named after its directory), \`off\`.
                fix: move it into a domain folder: \`specs/<facet>/<domain>/<aspect>.spec.ts\`
                read: docs/19-linting.md#specs-at-declared-depth
        `);
    });

    test('a first-level folder of modules alone is refused, its runner too; a single test makes a suite', async () => {
        // Given - the first-level tree
        const result = await lint.fixture(directory('./_fixtures/first-level/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/support/next-cursor.ts:2:1  jterrazz(specs-at-declared-depth)
                found: a module in \`specs/support/\`, a first-level folder that is no facet, not \`_shared/\`, and holds no test of its own
                why: A specs tree DECLARES its shape through the \`depth\` option: \`facet-domain\` (the default — a test at facet/domain depth), \`facet\` (a test at the facet root OR one domain folder down, never deeper), \`mirror\` (a test at any depth ≥ 1, named after its directory), \`off\`.
                fix: move a runner to the root of the facet it builds (\`specs/<facet>/<name>.specification.ts\`), a test helper into the \`_setup/\` of the lowest folder its tests share, and a fixture in the ground of the lowest folder its tests share (\`specs/_shared/_fixtures/\` across facets); then remove \`specs/support/\`
                read: docs/19-linting.md#specs-at-declared-depth
            specs/support/support.specification.ts:2:1  jterrazz(specs-at-declared-depth)
                found: a module in \`specs/support/\`, a first-level folder that is no facet, not \`_shared/\`, and holds no test of its own
                why: A specs tree DECLARES its shape through the \`depth\` option: \`facet-domain\` (the default — a test at facet/domain depth), \`facet\` (a test at the facet root OR one domain folder down, never deeper), \`mirror\` (a test at any depth ≥ 1, named after its directory), \`off\`.
                fix: move a runner to the root of the facet it builds (\`specs/<facet>/<name>.specification.ts\`), a test helper into the \`_setup/\` of the lowest folder its tests share, and a fixture in the ground of the lowest folder its tests share (\`specs/_shared/_fixtures/\` across facets); then remove \`specs/support/\`
                read: docs/19-linting.md#specs-at-declared-depth
        `);
    });
});
