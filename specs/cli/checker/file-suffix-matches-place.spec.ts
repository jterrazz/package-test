import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker-cli.specification.js';

describe('file-suffix-matches-place', () => {
    test('renames the spec, and leaves the two files that are not its own', async () => {
        // Given - the same tree, where `specs/build/` is a repository suite and `specs/api/helpers/normalize.test.ts` reaches no runner
        const result = await cli
            .fixture(directory('../../_shared/_fixtures/file-suffix-matches-place-placement/'))
            .exec('specs --fix');

        // Then - one rename; the glob and the literal entry it broke, and nothing else: not the commented-out glob, not the `src/` one whose files it never touched, not the repository suite's
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            conventions checker: renamed api/users/creation.test.ts → api/users/creation.spec.ts (file-suffix-matches-place)
            conventions checker: vitest.config.ts: specs/api/**/*.test.ts still names \`.test.ts\` — the files it collected are \`.spec.ts\` now, and the project collects nothing until the glob follows (file-suffix-matches-place)
            conventions checker: vitest.config.ts: specs/api/users/creation.test.ts names a file this run renamed — it is \`specs/api/users/creation.spec.ts\` now, and the entry collects nothing until it follows (file-suffix-matches-place)
        `);
        expect(result.stderr).toMatch(`
            api/helpers/normalize.test.ts:1:1: error jterrazz-check(facet-test-uses-its-runner): found: a test under the \`api\` facet that reaches no runner · why: A test under \`specs/<facet>/\`, where the facet root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself. · fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test beside its module · read: docs/19-linting.md#facet-test-uses-its-runner

            conventions checker: 1 error(s) found under {{workdir}}/specs
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });
});
