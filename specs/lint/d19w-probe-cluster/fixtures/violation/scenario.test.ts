import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('greps one output three times', () => {
    // Given - a result whose stream the test reads piece by piece
    const result = { stdout: scenario() };
    // Then - three probes and no golden
    expect(result.stdout).toContain('scen');
    expect(result.stdout).toContain('ari');
    expect(result.stdout).toContain('rio');
});
