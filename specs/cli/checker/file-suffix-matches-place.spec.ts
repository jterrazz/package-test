import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

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
            api/helpers/normalize.test.ts:1:1: error jterrazz-check(facet-test-uses-its-runner): found: a test under the \`api\` facet that reaches no runner · why: A test under \`specs/<facet>/\`, where the facet root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself. · fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test beside its module · read: docs/24-linting.md#facet-test-uses-its-runner
            found: every finding above, and .jterrazz/baseline.json records no \`jterrazz-check/\` entry in its \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'typescript baseline' to record where the project stands · read: docs/24-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
        expect(result.stderr.text).toBe('');
    });
});
