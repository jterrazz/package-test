import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('samples the clock into its Given', () => {
    // Given - a scenario and an ambient instant
    const started = Date.now();
    const value = `${scenario()}-${String(started > 0)}`;
    // Then - it names itself
    expect(value).toBe('scenario-true');
});
