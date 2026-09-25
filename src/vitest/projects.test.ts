import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../world/services/containers/run-setup.js';
import { api, cli, integration, job, mobile, unit } from './projects.js';

/** The `test` block of a project, whatever the helper wrapped around it. */
function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

describe('projects', () => {
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

    test('the node facet helpers — one canonical project per kind — each collects its own facet tree, under its own name', () => {
        // Given - the canonical projects, stated by nobody
        // Then - `--project api` means the same tree in every repository
        expect(
            [api(), job(), integration(), mobile()].map((project) => testOf(project).name),
        ).toStrictEqual(['api', 'job', 'integration', 'mobile']);
        // The suffix is the fork: a facet collects the ASSEMBLED product, and
        // the word for that is `.spec.ts`.
        expect(testOf(api()).include).toStrictEqual(['specs/api/**/*.spec.ts']);
        expect(testOf(integration()).include).toStrictEqual(['specs/integration/**/*.spec.ts']);
    });

    test('the node facet helpers — one canonical project per kind — the facets that declare services carry the setup that starts them once per project', () => {
        // Given - the global setups of the three facets whose specs declare containers
        const setups = [api(), job(), integration()].map((project) => testOf(project).globalSetup);

        // Then - each serves the project's containers, which a file without it starts per specification
        for (const carried of setups) {
            expect(carried).toContain(servicesSetup());
        }
        expect(servicesSetup()).toMatch(/run-setup\.ts$/u);
    });

    test('the node facet helpers — one canonical project per kind — node facets run first, and the simulator runs alone at the end', () => {
        // Given - the group order each helper states
        const orders = [api(), job(), integration(), cli(), mobile()].map(
            (project) => testOf(project).sequence?.groupOrder,
        );

        // Then - everything node shares group 0; website is 1, component 2, and a simulator cannot share a machine with itself
        expect(orders).toStrictEqual([0, 0, 0, 0, 3]);
    });

    test('the node facet helpers — one canonical project per kind — takes the tree and the budget a repository states instead', () => {
        // Given - a facet whose tree and budget are not the convention's
        const stated = testOf(
            api({
                exclude: ['specs/api/slow/**'],
                include: ['suites/api/**/*.test.ts'],
                timeout: 90_000,
            }),
        );

        // Then - all three are the repository's, the name stays canonical
        expect(stated.include).toStrictEqual(['suites/api/**/*.test.ts']);
        // The preset's own exclusions are never dropped — vite concatenates,
        // so a repository ADDS to the ground exclusion rather than having to restate it.
        expect(stated.exclude).toContain('specs/api/slow/**');
        expect(stated.exclude).toContain('**/{expected,fixtures,requests,seeds}/**');
        expect(stated.testTimeout).toBe(90_000);
        expect(stated.name).toBe('api');
    });

    test('the node facet helpers — one canonical project per kind — a node facet states its own serial run, the way website() does', () => {
        // Given - an integration suite whose files share one database file
        const shared = testOf(integration({ serial: true }));

        // Then - the project states it, and a silent helper states nothing
        expect(shared.fileParallelism).toBe(false);
        expect(testOf(integration()).fileParallelism).toBeUndefined();
    });

    test('the node facet helpers — one canonical project per kind — every helper takes it, not only the ones 15.2 shipped it on', () => {
        // Given - the four other helpers this release adds
        const serial = [api, job, mobile].map((helper) => testOf(helper({ serial: true })));

        // Then - `serial` is what chapter 02 says it is: every helper's
        expect(serial.map((project) => project.fileParallelism)).toStrictEqual([
            false,
            false,
            false,
        ]);
        expect(testOf(cli({ literate: false, serial: true })).fileParallelism).toBe(false);
    });
});
