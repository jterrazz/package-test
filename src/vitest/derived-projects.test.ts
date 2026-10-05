import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { derivedProjects } from './derived-projects.js';

const SPECIFICATIONS = ['unit', 'cli', 'api', 'component'];

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
        // Given - module tests in src/, lint/ and a folder of specs/ no specification names, tests in ground, setup, dot and install folders, two specification folders and a rendered test
        const root = tree([
            'src/orders.test.ts',
            'src/button.test.tsx',
            'lint/rule.test.ts',
            'specs/surface/exports.test.ts',
            'specs/_shared/_fixtures/stray.test.ts',
            'src/_fixtures/stray.test.ts',
            '.artifacts/sandbox/copy.test.ts',
            'node_modules/package/index.test.ts',
            'specs/api/orders.spec.ts',
            'specs/cli/run.spec.ts',
            'docs/guide.md',
            'docs/_fixtures/example.test.ts',
        ]);

        // Then - each project with the options the tree gives it
        expect(Object.fromEntries(derivedProjects(root, SPECIFICATIONS))).toStrictEqual({
            api: {},
            cli: {},
            component: { include: ['src/**/*.test.tsx'] },
            unit: { roots: ['lint', 'src', 'specs/surface'] },
        });
    });

    test('derived-projects — the component specs are collected from their folder, and a tree holding no test derives nothing else', () => {
        // Given - a tree whose only tests are the component specs, and one holding no test and no specs/
        const component = tree(['specs/component/page.test.tsx', 'src/page.tsx']);
        const bare = tree(['src/index.ts']);

        // Then - the component project alone, then nothing
        expect(Object.fromEntries(derivedProjects(component, SPECIFICATIONS))).toStrictEqual({
            component: { include: ['specs/component/**/*.test.tsx'] },
        });
        expect(derivedProjects(bare, SPECIFICATIONS).size).toBe(0);
    });
});
