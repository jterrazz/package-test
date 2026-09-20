import { expect, test } from 'vitest';

import { match } from '../../../src/model/matching/match.js';

test('matches a uuid', () => {
    // Given - a uuid matcher
    const matcher = match.uuid();

    // Then - defined
    expect(matcher).toBeDefined();
});
