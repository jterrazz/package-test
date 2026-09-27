import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { specsAtDeclaredDepth } from './specs-at-declared-depth.js';

const SUITES = groundTree({ 'posts/add/add.test.ts': '', 'tree/row-names.test.ts': '' });

ruleTester().run('specs-at-declared-depth', asOxlintRule(specsAtDeclaredDepth), {
    invalid: [
        // A test directly at the facet root — no domain folder.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testAtFacetRoot' }],
            filename: '/repo/specs/job/job.test.ts',
        },
        // A test nested deeper than facet/domain.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testTooDeep' }],
            filename: '/repo/specs/cli/check/linter/linter.test.ts',
        },
        // A specification inside a domain rather than at the facet root.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specNotAtFacetRoot' }],
            filename: '/repo/specs/api/intercepts/intercepts.specification.ts',
        },
        // `_shared/` is the shared ground, never a facet: no spec and no specification under it.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInShared' }],
            filename: '/repo/specs/_shared/users/listed.spec.ts',
        },
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInShared' }],
            filename: '/repo/specs/_shared/shared.specification.ts',
        },
        // The facet level is reserved whatever depth the tree declares.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInShared' }],
            filename: '/repo/specs/_shared/tree/tree.spec.ts',
            options: [{ depth: 'off' }],
        },
    ],
    valid: [
        // Tests at facet/domain depth (aspect name is free).
        { code: 'const x = 1;', filename: '/repo/specs/api/responses/responses.test.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/cli/check/linter.test.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/integration/redis/redis.test.ts' },
        // Specifications at the facet root.
        { code: 'const x = 1;', filename: '/repo/specs/api/api.specification.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/cli/cli.specification.ts' },
        // Only the `_` names are reserved: a domain or a route's segment takes any word,
        // `shared` included (`GET /shared` files under `api/shared/get/`).
        { code: 'const x = 1;', filename: '/repo/specs/integration/shared/shared.spec.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/api/shared/get/listed.spec.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/api/documents/shared/sharing.spec.ts' },
        {
            code: 'const x = 1;',
            filename: '/repo/specs/integration/shared/shared.spec.ts',
            options: [{ depth: 'facet' }],
        },
        // Module tests under src/ follow the neighbour rule (`test-beside-its-module`), not `specs-at-declared-depth`.
        { code: 'const x = 1;', filename: '/repo/src/specification/matching/match.test.ts' },
        // The default is explicit-equivalent: stating it changes nothing.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/api/responses/responses.test.ts',
            options: [{ depth: 'facet-domain' }],
        },
    ],
});

ruleTester().run('specs-at-declared-depth (depth: facet)', asOxlintRule(specsAtDeclaredDepth), {
    invalid: [
        // A test loose at the specs root belongs to no facet.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testOutsideFacet' }],
            filename: '/repo/specs/row-names.test.ts',
            options: [{ depth: 'facet' }],
        },
        // A test nested below the one domain folder the mode allows.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testTooDeepForFacet' }],
            filename: '/repo/specs/tree/rows/names/names.test.ts',
            options: [{ depth: 'facet' }],
        },
        // A specification inside a domain rather than at the facet root.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specNotAtFacetRoot' }],
            filename: `${SUITES}/tree/rows/tree.specification.ts`,
            options: [{ depth: 'facet' }],
        },
    ],
    valid: [
        // At the facet root — the asset-less sibling shape.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/tree/row-names.test.ts',
            options: [{ depth: 'facet' }],
        },
        // One domain down — the shape a test with its own assets earns.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/source/import-paths/import-paths.test.ts',
            options: [{ depth: 'facet' }],
        },
        // Specifications sit at the facet root, exactly as in facet-domain.
        {
            code: 'const x = 1;',
            filename: `${SUITES}/tree/tree.specification.ts`,
            options: [{ depth: 'facet' }],
        },
        {
            code: 'const x = 1;',
            filename: '/repo/src/specification/matching/match.test.ts',
            options: [{ depth: 'facet' }],
        },
    ],
});

ruleTester().run('specs-at-declared-depth (depth: mirror)', asOxlintRule(specsAtDeclaredDepth), {
    invalid: [
        // A test loose at the specs root mirrors nothing.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testAtSpecsRoot' }],
            filename: '/repo/specs/logs.test.ts',
            options: [{ depth: 'mirror' }],
        },
        // A test not named after the directory holding it.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testNotMirroringDirectory' }],
            filename: '/repo/specs/posts/add/creation.test.ts',
            options: [{ depth: 'mirror' }],
        },
        ...['/repo/specs/cli.specification.ts', `${SUITES}/posts/add/add.specification.ts`].map(
            (filename) => ({
                code: 'const x = 1;',
                errors: [{ messageId: 'specNotAtFacetRoot' }],
                filename,
                options: [{ depth: 'mirror' }],
            }),
        ),
    ],
    valid: [
        // One directory deep — a top-level leaf.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/logs/logs.test.ts',
            options: [{ depth: 'mirror' }],
        },
        // Two deep — a leaf under a namespace.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/infrastructure/pods/pods.test.ts',
            options: [{ depth: 'mirror' }],
        },
        // Three deep — the mirror has no maximum, unlike facet-domain.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/a/b/c/c.test.ts',
            options: [{ depth: 'mirror' }],
        },
        {
            code: 'const x = 1;',
            filename: `${SUITES}/posts/posts.specification.ts`,
            options: [{ depth: 'mirror' }],
        },
        {
            code: 'const x = 1;',
            filename: '/repo/src/specification/matching/match.test.ts',
            options: [{ depth: 'mirror' }],
        },
    ],
});

function groundTree(files: Record<string, string>): string {
    const prefix = resolve(tmpdir(), 'specs-at-declared-depth-ground-');
    const root = resolve(mkdtempSync(prefix), 'specs');
    for (const [path, content] of Object.entries(files)) {
        const full = resolve(root, path);
        mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true });
        writeFileSync(full, content);
    }
    return root;
}

const CODE_GROUND = groundTree({
    // Ground that is code: the subject's build, its unit test, and a stray spec.
    'cli/_fixtures/binary/binary.test.ts': '',
    'cli/_fixtures/binary/binary.ts': '',
    'cli/_fixtures/binary/orphan.test.ts': '',
    'cli/_fixtures/binary/binary.specification.ts': '',
    'api/_setup/pagination.ts': '',
    'api/_setup/pagination.test.ts': '',
    // A first-level folder of helpers and a runner, holding no test.
    'support/next-cursor.ts': '',
    'support/support.specification.ts': '',
});

ruleTester().run('specs-at-declared-depth (ground)', asOxlintRule(specsAtDeclaredDepth), {
    invalid: [
        // A test in ground with no module beside it is a spec that wandered in.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInReserved' }],
            filename: `${CODE_GROUND}/cli/_fixtures/binary/orphan.test.ts`,
        },
        // A runner never belongs to the ground, module beside it or not.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInReserved' }],
            filename: `${CODE_GROUND}/cli/_fixtures/binary/binary.specification.ts`,
        },
        // The clause holds in every mode, `off` included.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInReserved' }],
            filename: `${CODE_GROUND}/cli/_fixtures/binary/orphan.test.ts`,
            options: [{ depth: 'off' }],
        },
        // A module in a first-level folder holding no test, in every mode.
        ...['facet-domain', 'off'].map((depth) => ({
            code: 'const x = 1;',
            errors: [{ messageId: 'strayFolder' }],
            filename: `${CODE_GROUND}/support/next-cursor.ts`,
            options: [{ depth }],
        })),
        // A runner is a module too: it makes no suite of a folder holding no test.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'strayFolder' }],
            filename: `${CODE_GROUND}/support/support.specification.ts`,
        },
        // The reserved names hold no spec: a spec under one, `_setup/` included, is refused.
        ...['_expected', '_fixtures', '_requests', '_seeds', '_setup'].map((reserved) => ({
            code: 'const x = 1;',
            errors: [{ messageId: 'specInReserved' }],
            filename: `${CODE_GROUND}/api/${reserved}/${reserved}.spec.ts`,
        })),
    ],
    valid: [
        // `test-beside-its-module`'s pairing inside its ground: the depth rules never reach it.
        { code: 'const x = 1;', filename: `${CODE_GROUND}/cli/_fixtures/binary/binary.test.ts` },
        { code: 'const x = 1;', filename: `${CODE_GROUND}/api/_setup/pagination.test.ts` },
        {
            code: 'const x = 1;',
            filename: `${CODE_GROUND}/cli/_fixtures/binary/binary.test.ts`,
            options: [{ depth: 'mirror' }],
        },
    ],
});

ruleTester().run('specs-at-declared-depth (depth: off)', asOxlintRule(specsAtDeclaredDepth), {
    invalid: [
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specNotAtFacetRoot' }],
            filename: '/repo/specs/api/intercepts/intercepts.specification.ts',
            options: [{ depth: 'off' }],
        },
    ],
    valid: [
        '/repo/specs/job/job.test.ts',
        '/repo/specs/cli/check/linter/linter.test.ts',
        '/repo/specs/api/intercepts.specification.ts',
    ].map((filename) => ({ code: 'const x = 1;', filename, options: [{ depth: 'off' }] })),
});
