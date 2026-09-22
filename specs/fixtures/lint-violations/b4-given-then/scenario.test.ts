import { test } from 'vitest';

test('is missing its Given marker', () => {
    // Then - only the outcome is documented
    build();
});

test('is missing its Then marker', () => {
    // Given - only the setup is documented
    build();
});

test('is missing both markers', () => {
    build();
});
