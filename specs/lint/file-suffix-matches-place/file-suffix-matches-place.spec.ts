import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('file-suffix-matches-place', () => {
    test('rejects a case name that only repeats its directory', async () => {
        // Given - specs/rm/rm.spec.yaml
        const result = await checker
            .fixture(directory('./_fixtures/file-suffix-matches-place/'))
            .run();

        // Then - the pass names the document, the line and what to write instead
        expect(result.report).toMatch(`
            specs/rm/rm.spec.yaml:1:1  jterrazz-check(file-suffix-matches-place)
                found: "rm.spec.yaml" repeats its directory "rm/"
                why: The suffix says the kind, and the tree agrees with it.
                fix: name it for what this case proves, not where it sits
                read: docs/19-linting.md#file-suffix-matches-place
        `);
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/spec-document-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('renames a `.test.ts` that sits under a facet folder', async () => {
        // Given - a tree holding `specs/api/users/creation.test.ts`
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/file-suffix-matches-place-placement/'))
            .run();

        // Then - the facet folder already says what it specifies; only the word is wrong
        expect(result.report).toMatch(`
            specs/api/helpers/normalize.test.ts:1:1  jterrazz-check(facet-test-uses-its-runner)
                found: a test under the \`api\` facet that reaches no runner
                why: A test under \`specs/<facet>/\`, where the facet root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself.
                fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test beside its module
                read: docs/19-linting.md#facet-test-uses-its-runner
            specs/api/users/creation.test.ts:1:1  jterrazz-check(file-suffix-matches-place)
                found: a \`.test.ts\` under \`specs/api/\`, where a file specifies the assembled product
                why: The suffix says the kind, and the tree agrees with it.
                fix: rename it \`api/users/creation.spec.ts\` — \`make fix\` does it with \`git mv\`
                read: docs/19-linting.md#file-suffix-matches-place
        `);
    });

    test("renames under a tree that is one facet's whole, with no facet level", async () => {
        // Given - a tree whose runner sits at its ROOT: the folders below it are domains, not facets
        const result = await checker
            .fixture(directory('./_fixtures/file-suffix-matches-place-rooted-facet/'))
            .run();

        // Then - the spec is named, and the ground module's own test beside its module is not
        expect(result.report).toMatch(`
            specs/operator/manifest/manifest.test.ts:1:1  jterrazz-check(file-suffix-matches-place)
                found: a \`.test.ts\` under \`specs/\`, where a file specifies the assembled product
                why: The suffix says the kind, and the tree agrees with it.
                fix: rename it \`operator/manifest/manifest.spec.ts\` — \`make fix\` does it with \`git mv\`
                read: docs/19-linting.md#file-suffix-matches-place
        `);
    });

    test("names a `.spec.ts` at a member's own root, the one place ls-lint never judges", async () => {
        // Given - a member holding `creation.spec.ts` at its root
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member packages/stray-spec' });

        // Then - the member pass is the only run that sees outside a specs tree
        expect(result.report).toMatch(`
            packages/stray-spec/creation.spec.ts:1:1  jterrazz-check(file-suffix-matches-place)
                found: a \`.spec.ts\` at the project's root, outside every \`specs/\` tree
                why: The suffix says the kind, and the tree agrees with it.
                fix: move it under \`specs/<facet>/\`, or rename it \`creation.test.ts\` beside the module it covers
                read: docs/19-linting.md#file-suffix-matches-place
        `);
    });
});
