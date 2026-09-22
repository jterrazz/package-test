import { expect, test } from 'vitest';

import { scenario } from './scenario.js';

test('states every instant it depends on', () => {
    // Given - a scenario and a pinned instant
    const started = new Date('2026-03-04T09:30:00Z');
    const value = `${scenario()}-${String(started.getUTCFullYear())}`;
    // Then - it names itself
    expect(value).toBe('scenario-2026');
});
