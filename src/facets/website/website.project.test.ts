import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { website } from './website.project.js';

/** The `test` block of a project, whatever the helper wrapped around it. */
function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

describe('website() — the served product', () => {
    test('collects the website specs and opens its browser before the component one', () => {
        // Given - the canonical website project
        const project = testOf(website());

        // Then - one name, the `.spec.ts` tree, and the group between node and component
        expect(project.name).toBe('website');
        expect(project.include).toStrictEqual(['specs/website/**/*.spec.ts']);
        expect(project.sequence).toStrictEqual({ groupOrder: 1 });
    });

    test('runs its files one at a time when the served app is shared', () => {
        // Given - three website specs sharing one server and one database file
        const shared = testOf(website({ serial: true }));

        // Then - the project states it, so no consumer spreads it back over the helper
        expect(shared.fileParallelism).toBe(false);
        expect(testOf(website()).fileParallelism).toBeUndefined();
    });

    test('takes the globs and the budget a project states instead', () => {
        // Given - a repository whose pages are specified elsewhere, and slowly
        const project = testOf(website({ include: ['e2e/**/*.test.ts'], timeout: 60_000 }));

        // Then - what it states is what it collects, and how long it gets
        expect(project.include).toStrictEqual(['e2e/**/*.test.ts']);
        expect(project.testTimeout).toBe(60_000);
    });
});
