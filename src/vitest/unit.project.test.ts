import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { unit } from './unit.project.js';

function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

describe('unit', () => {
    test('unit() — module tests, and only module tests — collects .test.ts outside specs/ and leaves .test.tsx to the browser', () => {
        // Given - the canonical project, stated by nobody
        const project = testOf(unit());

        // Then - a rendered thing is not a module test, and specs/ is another kind
        expect(project.include).toStrictEqual(['**/*.test.ts']);
        expect(project.exclude).toContain('**/*.test.tsx');
        expect(project.exclude).toContain('specs/**');
        expect(project.name).toBe('unit');
    });

    test('unit() — module tests, and only module tests — carries the preset budget, and the one a project states instead', () => {
        // Given - a project that needs longer than the shared 30s
        const stated = testOf(unit({ timeout: 60_000 }));

        // Then - the budget is the project's, the rest stays the preset's
        expect(stated.testTimeout).toBe(60_000);
        expect(testOf(unit()).testTimeout).toBe(30_000);
    });

    test('unit() — module tests, and only module tests — takes the globs a project states over the canonical ones', () => {
        // Given - a repository whose modules do not sit at the root
        const project = testOf(unit({ exclude: [], include: ['packages/**/*.test.ts'] }));

        // Then - what it states is what it collects
        expect(project.include).toStrictEqual(['packages/**/*.test.ts']);
    });

    test('unit() — module tests, and only module tests — turns the trees a repository names into the globs that collect them', () => {
        // Given - a repository whose modules live under two roots
        const project = testOf(unit({ roots: ['packages', 'apps/'] }));

        // Then - each root is a glob, and the trailing slash is not a second one
        expect(project.include).toStrictEqual(['packages/**/*.test.ts', 'apps/**/*.test.ts']);
    });

    test('unit() — module tests, and only module tests — shares one module graph per worker when a pure project says so, and isolates otherwise', () => {
        // Given - a project whose tests leave no state behind, and one stated by nobody
        const shared = testOf(unit({ isolate: false }));

        // Then - the pure one runs its files in one graph per worker, the other is vitest's default
        expect(shared.isolate).toBe(false);
        expect(testOf(unit())).not.toHaveProperty('isolate');
    });

    test('unit() — module tests, and only module tests — runs before either browser project', () => {
        // Given - the canonical project
        // Then - node first (0), the page facets after
        expect(testOf(unit()).sequence).toStrictEqual({ groupOrder: 0 });
    });
});
