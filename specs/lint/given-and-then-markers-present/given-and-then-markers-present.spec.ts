import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('given-and-then-markers-present', () => {
    test('accepts both markers, optional When, and skipIf wrappers', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects Given declared after Then', async () => {
        // Given - the position tree
        const result = await lint.fixture(directory('./__fixtures__/position/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            __tests__/scenario.test.ts:4:1  jterrazz(given-and-then-markers-present)
                found: \`// Given -\` written after \`// Then -\`
                why: Every test carries \`// Given -\` then \`// Then -\` (both, in that order); a Given declared after a Then is an error.
                fix: move the Given marker above the setup it narrates, before the Then
                read: docs/reference/linting.md#given-and-then-markers-present
            __tests__/scenario.test.ts:10:1  jterrazz(given-and-then-markers-present)
                found: \`// Given -\` written after \`// Then -\`
                why: Every test carries \`// Given -\` then \`// Then -\` (both, in that order); a Given declared after a Then is an error.
                fix: move the Given marker above the setup it narrates, before the Then
                read: docs/reference/linting.md#given-and-then-markers-present
        `);
    });

    test('rejects tests missing Given or Then markers', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            __tests__/scenario.test.ts:4:1  jterrazz(given-and-then-markers-present)
                found: the test has no \`// Given -\` marker
                why: Every test carries \`// Given -\` then \`// Then -\` (both, in that order); a Given declared after a Then is an error.
                fix: write \`// Given - <a sentence about the subject>\`; every test carries a Given, then a Then
                read: docs/reference/linting.md#given-and-then-markers-present
            __tests__/scenario.test.ts:9:1  jterrazz(given-and-then-markers-present)
                found: the test has no \`// Then -\` marker
                why: Every test carries \`// Given -\` then \`// Then -\` (both, in that order); a Given declared after a Then is an error.
                fix: write \`// Then - <a sentence about the subject>\`; every test carries a Given, then a Then
                read: docs/reference/linting.md#given-and-then-markers-present
            __tests__/scenario.test.ts:14:1  jterrazz(given-and-then-markers-present)
                found: the test has no \`// Given -\` marker
                why: Every test carries \`// Given -\` then \`// Then -\` (both, in that order); a Given declared after a Then is an error.
                fix: write \`// Given - <a sentence about the subject>\`; every test carries a Given, then a Then
                read: docs/reference/linting.md#given-and-then-markers-present
            __tests__/scenario.test.ts:14:1  jterrazz(given-and-then-markers-present)
                found: the test has no \`// Then -\` marker
                why: Every test carries \`// Given -\` then \`// Then -\` (both, in that order); a Given declared after a Then is an error.
                fix: write \`// Then - <a sentence about the subject>\`; every test carries a Given, then a Then
                read: docs/reference/linting.md#given-and-then-markers-present
        `);
    });
});
