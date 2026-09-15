import { expect, test } from 'vitest';

import { match } from '../../../src/specification/matching/match.js';

test('matches a uuid', () => {
    // Given - a uuid matcher
    const matcher = match.uuid();

    // Then - defined
    expect(matcher).toBeDefined();
});
