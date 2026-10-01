import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../../services/containers/run-setup.js';
import { api } from './api.project.js';

function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

describe('api', () => {
    test('api() — the canonical api project — collects the api specs under its own name, in the node group', () => {
        // Given - the canonical api project, stated by nobody
        const project = testOf(api());

        // Then - `--project api` means the same tree in every repository, run with the node facets
        expect(project.name).toBe('api');
        expect(project.include).toStrictEqual(['specs/api/**/*.spec.ts']);
        expect(project.sequence?.groupOrder).toBe(0);
    });

    test('api() — the canonical api project — carries the setup that starts the declared services once per run', () => {
        // Given - the global setups of the canonical api project
        // Then - it joins the run's containers, which a file without it starts per specification
        expect(testOf(api()).globalSetup).toContain(servicesSetup());
        expect(servicesSetup()).toMatch(/run-setup\.ts$/u);
    });

    test('api() — the canonical api project — takes the tree and the budget a repository states instead', () => {
        // Given - a facet whose tree and budget are not the convention's
        const stated = testOf(
            api({
                exclude: ['specs/api/slow/**'],
                include: ['suites/api/**/*.test.ts'],
                timeout: 90_000,
            }),
        );

        // Then - all three are the repository's, the name and the ground exclude stay canonical
        expect(stated.include).toStrictEqual(['suites/api/**/*.test.ts']);
        expect(stated.exclude).toContain('specs/api/slow/**');
        expect(stated.exclude).toContain('**/{_expected,_fixtures,_requests,_seeds}/**');
        expect(stated.testTimeout).toBe(90_000);
        expect(stated.name).toBe('api');
    });

    test('api() — the canonical api project — runs its files one at a time when asked to', () => {
        // Given - an api suite whose files share one database
        // Then - the project states it
        expect(testOf(api({ serial: true })).fileParallelism).toBe(false);
    });
});
