import { expect, test } from 'vitest';

test('sits at the specs root, where specs-at-declared-depth — a rule of the specs reach — finds it', () => {
    // Given - a spec with no facet folder
    const where = 'specs';

    // Then - it is named
    expect(where).toBe('specs');
});
