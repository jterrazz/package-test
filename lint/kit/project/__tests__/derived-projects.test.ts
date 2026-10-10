import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { derivedProjects } from '../derived-projects.js';

function tree(files: readonly string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'derived-projects-'));
    for (const file of files) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), '');
    }

    return root;
}

describe('derivedProjects', () => {
    test('derived-projects — a project per specification folder, the unit project over each root holding a module test, the component one over each holding a rendered one', () => {
        // Given - module tests in the tests folders of src/ and lint/, one in a folder of specs/ no specification names, tests in ground, setup, dot and install folders, two specification folders, rendered tests, a snapshot of one, and folders whose names only begin like an install or a build
        const root = tree([
            'src/__tests__/orders.test.ts',
            'src/__tests__/button.test.tsx',
            'lint/__tests__/rule.test.ts',
            'specs/surface/exports.test.ts',
            'specs/__fixtures__/stray.test.ts',
            'src/__fixtures__/stray.test.ts',
            '.artifacts/sandbox/copy.test.ts',
            'node_modules/package/index.test.ts',
            'specs/api/orders.spec.ts',
            'specs/cli/run.spec.ts',
            'docs/guide.md',
            'docs/__fixtures__/example.test.ts',
            'app/__tests__/page.test.tsx',
            'web/view.test.tsx.snap',
            'distance/__tests__/route.test.ts',
            'node_modules.bak/__tests__/stray.test.ts',
        ]);

        // Then - each project with the options the tree gives it
        expect(Object.fromEntries(derivedProjects(root))).toStrictEqual({
            api: {},
            cli: {},
            component: { include: ['app/**/*.test.tsx', 'src/**/*.test.tsx'] },
            unit: { roots: ['distance', 'lint', 'node_modules.bak', 'src', 'specs/surface'] },
        });
    });

    test('derived-projects — the component specs are collected from their folder, and a tree holding no test derives nothing else', () => {
        // Given - a tree whose only tests are the component specs, and one holding no test and no specs/
        const component = tree(['specs/component/page.test.tsx', 'src/page.tsx']);
        const bare = tree(['src/index.ts']);

        // Then - the component project alone, then nothing
        expect(Object.fromEntries(derivedProjects(component))).toStrictEqual({
            component: { include: ['specs/component/**/*.test.tsx'] },
        });
        expect(derivedProjects(bare).size).toBe(0);
    });

    test('derived-projects — a specs/unit/ folder is one more root of the unit project, never a project of its own', () => {
        // Given - module tests in src/ and in specs/unit/
        const root = tree(['src/orders.test.ts', 'specs/unit/pricing.test.ts']);

        // Then - one unit project over both roots
        expect(Object.fromEntries(derivedProjects(root))).toStrictEqual({
            unit: { roots: ['src', 'specs/unit'] },
        });
    });

    test('derived-projects — an in-process specification is handed its runner where its folder’s one specification module is named for it', () => {
        // Given - api with its one runner, job with two, integration with one named otherwise, and cli, which runs no subject in-process
        const root = tree([
            'specs/api/api.specification.ts',
            'specs/api/orders.spec.ts',
            'specs/job/job.specification.ts',
            'specs/job/other.specification.ts',
            'specs/integration/redis.specification.ts',
            'specs/cli/cli.specification.ts',
        ]);

        // Then - the api project alone runs its files in one module graph
        expect(Object.fromEntries(derivedProjects(root))).toStrictEqual({
            api: { runner: './specs/api/api.specification.ts' },
            cli: {},
            integration: {},
            job: {},
        });
    });

    test('derived-projects — a workspace member named specs is the specs root itself: its folders are the specifications, and a project beside them holds the tests it names', () => {
        // Given - a member `specs` with a package manifest, a cli folder, an api folder with its one specification module, a rendered test folder of its own and module tests in a helper folder
        const parent = tree([
            'specs/package.json',
            'specs/cli/run.spec.ts',
            'specs/api/api.specification.ts',
            'specs/api/orders.spec.ts',
            'specs/__setup__/helper.ts',
            'specs/views/__tests__/page.test.tsx',
            'specs/helpers/__tests__/format.test.ts',
        ]);

        // Then - the cli and api projects at the member's root, the api one with its runner, and the unit and component ones over the member's own folders
        expect(Object.fromEntries(derivedProjects(join(parent, 'specs')))).toStrictEqual({
            api: { runner: './api/api.specification.ts' },
            cli: {},
            component: { include: ['views/**/*.test.tsx'] },
            unit: { roots: ['helpers'] },
        });
    });

    test('derived-projects — a folder named specs with no manifest of its own is the specs folder of the project around it, and one holding specs beneath is read as before', () => {
        // Given - a project root named `specs` with no package manifest, and a nested specs folder inside it
        const parent = tree(['specs/specs/cli/run.spec.ts']);

        // Then - the cli project, found beneath the nested folder only
        expect(Object.fromEntries(derivedProjects(join(parent, 'specs')))).toStrictEqual({
            cli: {},
        });
    });
});
