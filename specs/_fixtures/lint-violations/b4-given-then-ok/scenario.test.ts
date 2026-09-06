import { expect, test } from 'vitest';

test('carries both markers', () => {
    // Given - a widget
    // Then - it works
    expect(build()).toBe(true);
});

test('may add an optional When', () => {
    // Given - a widget
    // When - the build runs
    // Then - it works
    expect(build()).toBe(true);
});

test.skipIf(process.platform === 'win32')('is enforced through skipIf wrappers too', () => {
    // Given - a posix-only widget
    // Then - it works
    expect(build()).toBe(true);
});
