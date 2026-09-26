import { expect, test } from 'vitest';

// A test file the ROOT's walk must not claim: it belongs to `@fixture/clean`,
// which states its own config. Never collected — `_fixtures/` is excluded.
test('the member owns this file', () => {
    expect(true).toBe(true);
});
