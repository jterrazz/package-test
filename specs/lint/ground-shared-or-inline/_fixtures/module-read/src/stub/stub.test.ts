import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/** The stub, named from this module test. */
const STUB = resolve(import.meta.dirname, '../../specs/_shared/_fixtures/lonely-stub/');

describe('stub', () => {
test('names the stub', () => {
    // Given - the stub's folder
    // Then - it is named
    expect(STUB).toContain('lonely-stub');
});
});
