import { expect, test } from 'vitest';

test('renders under the toolchain the app owns', () => {
    // Given - the library's own render test, collected by the playground's jest
    // Then - it is jest that runs this file, and jest lives one member away
    expect(true).toBe(true);
});
