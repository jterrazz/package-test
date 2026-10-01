import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../../services/containers/run-setup.js';
import { integration } from './integration.project.js';

function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

describe('integration', () => {
    test('integration() — the canonical integration project — collects the integration specs in the node group, carrying the services setup', () => {
        // Given - the canonical integration project, stated by nobody
        const project = testOf(integration());

        // Then - its own tree under its own name, run with the node facets, the run's containers joined once
        expect(project.name).toBe('integration');
        expect(project.include).toStrictEqual(['specs/integration/**/*.spec.ts']);
        expect(project.sequence?.groupOrder).toBe(0);
        expect(project.globalSetup).toContain(servicesSetup());
    });

    test('integration() — the canonical integration project — states its own serial run, and a silent helper states nothing', () => {
        // Given - an integration suite whose files share one database file
        const shared = testOf(integration({ serial: true }));

        // Then - the project states it, and a silent helper states nothing
        expect(shared.fileParallelism).toBe(false);
        expect(testOf(integration()).fileParallelism).toBeUndefined();
    });
});
