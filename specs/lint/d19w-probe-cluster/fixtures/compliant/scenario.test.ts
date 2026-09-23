import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('keeps two probes as the scalpel they are', () => {
    // Given - a result whose stream the test reads
    const result = { stdout: scenario() };
    // Then - two targeted probes, below the cluster threshold
    expect(result.stdout).toContain('scen');
    expect(result.stdout).toContain('rio');
});
