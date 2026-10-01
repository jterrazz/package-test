import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../../services/containers/run-setup.js';
import { job } from './job.project.js';

function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

describe('job', () => {
    test('job() — the canonical job project — runs in the node group, carrying the setup that starts the declared services', () => {
        // Given - the canonical job project, stated by nobody
        const project = testOf(job());

        // Then - one name, the node group, and the run's containers joined once
        expect(project.name).toBe('job');
        expect(project.sequence?.groupOrder).toBe(0);
        expect(project.globalSetup).toContain(servicesSetup());
    });

    test('job() — the canonical job project — runs its files one at a time when asked to', () => {
        // Given - a job suite whose files share one database
        // Then - the project states it
        expect(testOf(job({ serial: true })).fileParallelism).toBe(false);
    });
});
