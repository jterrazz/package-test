import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('specs-at-declared-depth', () => {
    test('tests at specification/domain depth and a ground module beside its test pass', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch(``);
    });

    test('a test at the specification root, one in ground with no module beside it, and one under _shared/ are refused', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/__fixtures__/binary/scenarios.test.ts:1:1  jterrazz(specs-at-declared-depth)
                found: a spec under \`__fixtures__/\`, a reserved folder that is no subject
                why: A specs tree DECLARES its shape through the \`depth\` option: \`specification-domain\` (the default — a test at specification/domain depth), \`specification\` (a test at the specification root OR one domain folder down, never deeper), \`mirror\` (a test at any depth ≥ 1, named after its directory), \`off\`.
                fix: move the spec out of \`__fixtures__/\`, into the subject folder it specifies; a reserved folder that is code keeps only a \`<module>.test.ts\` next to its \`<module>.ts\`
                read: docs/reference/linting.md#specs-at-declared-depth
            specs/widget/widget.test.ts:1:1  jterrazz(specs-at-declared-depth)
                found: a spec directly at its specification root
                why: A specs tree DECLARES its shape through the \`depth\` option: \`specification-domain\` (the default — a test at specification/domain depth), \`specification\` (a test at the specification root OR one domain folder down, never deeper), \`mirror\` (a test at any depth ≥ 1, named after its directory), \`off\`.
                fix: move it into a domain folder: \`specs/<specification>/<domain>/<aspect>.spec.ts\`
                read: docs/reference/linting.md#specs-at-declared-depth
        `);
    });

    test('a first-level folder of modules alone is refused, its runner too; a single test makes a suite', async () => {
        // Given - the first-level tree
        const result = await lint.fixture(directory('./__fixtures__/first-level/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/support/next-cursor.ts:2:1  jterrazz(specs-at-declared-depth)
                found: a module in \`specs/support/\`, a first-level folder that is no specification, no special folder, and holds no test of its own
                why: A specs tree DECLARES its shape through the \`depth\` option: \`specification-domain\` (the default — a test at specification/domain depth), \`specification\` (a test at the specification root OR one domain folder down, never deeper), \`mirror\` (a test at any depth ≥ 1, named after its directory), \`off\`.
                fix: move a runner to the root of the specification it builds (\`specs/<specification>/<name>.specification.ts\`), a test helper into the \`__setup__/\` of the lowest folder its tests share, and a fixture in the ground of the lowest folder its tests share (\`specs/__fixtures__/\` across specifications); then remove \`specs/support/\`
                read: docs/reference/linting.md#specs-at-declared-depth
            specs/support/support.specification.ts:2:1  jterrazz(specs-at-declared-depth)
                found: a module in \`specs/support/\`, a first-level folder that is no specification, no special folder, and holds no test of its own
                why: A specs tree DECLARES its shape through the \`depth\` option: \`specification-domain\` (the default — a test at specification/domain depth), \`specification\` (a test at the specification root OR one domain folder down, never deeper), \`mirror\` (a test at any depth ≥ 1, named after its directory), \`off\`.
                fix: move a runner to the root of the specification it builds (\`specs/<specification>/<name>.specification.ts\`), a test helper into the \`__setup__/\` of the lowest folder its tests share, and a fixture in the ground of the lowest folder its tests share (\`specs/__fixtures__/\` across specifications); then remove \`specs/support/\`
                read: docs/reference/linting.md#specs-at-declared-depth
        `);
    });
});
