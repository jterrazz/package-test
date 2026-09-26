import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c1DomainStructure } from './specs-at-declared-depth.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SUITES = groundTree({ 'posts/add/add.test.ts': '', 'tree/row-names.test.ts': '' });

ruleTester.run('c1-domain-structure', c1DomainStructure as unknown as OxlintRule, {
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
        // `shared/` is the shared ground, never a facet: no spec and no specification under it.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInShared' }],
            filename: '/repo/specs/shared/users/listed.spec.ts',
        },
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInShared' }],
            filename: '/repo/specs/shared/shared.specification.ts',
        },
        // The facet level is reserved whatever depth the tree declares.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInShared' }],
            filename: '/repo/specs/shared/tree/tree.spec.ts',
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
        // `shared` is reserved only directly under `specs/`: deeper, a domain or a
        // route's segment takes the word (`GET /shared` files under `api/shared/get/`).
        { code: 'const x = 1;', filename: '/repo/specs/integration/shared/shared.spec.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/api/shared/get/listed.spec.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/api/documents/shared/sharing.spec.ts' },
        {
            code: 'const x = 1;',
            filename: '/repo/specs/integration/shared/shared.spec.ts',
            options: [{ depth: 'facet' }],
        },
        // Module tests under src/ follow the neighbour rule (I2), not C1.
        { code: 'const x = 1;', filename: '/repo/src/specification/matching/match.test.ts' },
        // The default is explicit-equivalent: stating it changes nothing.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/api/responses/responses.test.ts',
            options: [{ depth: 'facet-domain' }],
        },
    ],
});

ruleTester.run('c1-domain-structure (depth: facet)', c1DomainStructure as unknown as OxlintRule, {
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
        // Still out of scope under src/.
        {
            code: 'const x = 1;',
            filename: '/repo/src/specification/matching/match.test.ts',
            options: [{ depth: 'facet' }],
        },
    ],
});

ruleTester.run('c1-domain-structure (depth: mirror)', c1DomainStructure as unknown as OxlintRule, {
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
        // A mirror has no facet level, so specification files are unconstrained.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/cli.specification.ts',
            options: [{ depth: 'mirror' }],
        },
        {
            code: 'const x = 1;',
            filename: `${SUITES}/posts/add/add.specification.ts`,
            options: [{ depth: 'mirror' }],
        },
        // Still out of scope under src/.
        {
            code: 'const x = 1;',
            filename: '/repo/src/specification/matching/match.test.ts',
            options: [{ depth: 'mirror' }],
        },
    ],
});

function groundTree(files: Record<string, string>): string {
    const prefix = resolve(tmpdir(), 'c1-ground-');
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
    'cli/fixtures/binary/binary.test.ts': '',
    'cli/fixtures/binary/binary.ts': '',
    'cli/fixtures/binary/orphan.test.ts': '',
    'cli/fixtures/binary/binary.specification.ts': '',
    // A first-level folder of helpers and a runner, holding no test.
    'support/next-cursor.ts': '',
    'support/support.specification.ts': '',
});

ruleTester.run('c1-domain-structure (ground)', c1DomainStructure as unknown as OxlintRule, {
    invalid: [
        // A test in ground with no module beside it is a spec that wandered in.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInGround' }],
            filename: `${CODE_GROUND}/cli/fixtures/binary/orphan.test.ts`,
        },
        // A runner never belongs to the ground, module beside it or not.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInGround' }],
            filename: `${CODE_GROUND}/cli/fixtures/binary/binary.specification.ts`,
        },
        // The clause holds in every mode, `off` included.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specInGround' }],
            filename: `${CODE_GROUND}/cli/fixtures/binary/orphan.test.ts`,
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
        // The four names are reserved: a domain named with one is ground, and refused.
        ...['expected', 'fixtures', 'requests', 'seeds'].map((reserved) => ({
            code: 'const x = 1;',
            errors: [{ messageId: 'specInGround' }],
            filename: `${CODE_GROUND}/api/${reserved}/${reserved}.spec.ts`,
        })),
    ],
    valid: [
        // I2's pairing inside its ground: the depth rules never reach it.
        { code: 'const x = 1;', filename: `${CODE_GROUND}/cli/fixtures/binary/binary.test.ts` },
        {
            code: 'const x = 1;',
            filename: `${CODE_GROUND}/cli/fixtures/binary/binary.test.ts`,
            options: [{ depth: 'mirror' }],
        },
    ],
});

ruleTester.run('c1-domain-structure (depth: off)', c1DomainStructure as unknown as OxlintRule, {
    invalid: [],
    valid: [
        // The tree's shape is declared guarded elsewhere: everything is accepted.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/job/job.test.ts',
            options: [{ depth: 'off' }],
        },
        {
            code: 'const x = 1;',
            filename: '/repo/specs/cli/check/linter/linter.test.ts',
            options: [{ depth: 'off' }],
        },
        {
            code: 'const x = 1;',
            filename: '/repo/specs/api/intercepts/intercepts.specification.ts',
            options: [{ depth: 'off' }],
        },
    ],
});
