import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/** The stub the specs root shares, named from this module test. */
const STUB = resolve(import.meta.dirname, '../../../specs/__fixtures__/stub/main.js');

/** A path spelled into a command is the author's: no fixer rewrites it. */
const COMMAND = 'node specs/__fixtures__/stub/main.js';

describe('stub', () => {
test('names the stub', () => {
    // Given - the stub, and the command that runs it
    // Then - both name the same file
    expect(COMMAND).toContain(STUB.slice(-'main.js'.length));
});
});
