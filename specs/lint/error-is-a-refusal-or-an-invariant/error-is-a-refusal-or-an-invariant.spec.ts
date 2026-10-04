import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as self } from '../self-lint.specification.js';

describe('error-is-a-refusal-or-an-invariant', () => {
    test('a refusal reading a heading that exists, and an invariant, pass', async () => {
        // Given - the declared tree
        const result = await self.fixture(directory('./_fixtures/declared/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a hand-written message is refused where built, a subclass too, a missing heading where read', async () => {
        // Given - the hand-written tree
        const result = await self.fixture(directory('./_fixtures/hand-written/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/clock/clock.ts:3:15  jterrazz-check(error-is-a-refusal-or-an-invariant)
                found: \`new Error(…)\` carries a message written by hand
                why: An error a user can cause — a verb misused, an option out of range, a path, a peer or a tool the machine lacks, a peer or a runtime breaking its own contract — is thrown as a refusal: \`new Error(refusal(…))\`, its four parts found · why · fix · read, the read a heading of the manual written in place that exists (\`docs/reference/time-and-doubles.md#the-clock\`) or a catalogue row.
                fix: a user can cause it: \`new Error(refusal({ found, why, fix, read }))\`, its read the heading that explains it; only the framework can: \`invariant('<what broke>')\`
                read: docs/guides/test.md#error-is-a-refusal-or-an-invariant
            src/clock/clock.ts:11:15  jterrazz-check(error-is-a-refusal-or-an-invariant)
                found: \`new PinError(…)\` carries a message written by hand
                why: An error a user can cause — a verb misused, an option out of range, a path, a peer or a tool the machine lacks, a peer or a runtime breaking its own contract — is thrown as a refusal: \`new Error(refusal(…))\`, its four parts found · why · fix · read, the read a heading of the manual written in place that exists (\`docs/reference/time-and-doubles.md#the-clock\`) or a catalogue row.
                fix: a user can cause it: \`new PinError(refusal({ found, why, fix, read }))\`, its read the heading that explains it; only the framework can: \`invariant('<what broke>')\`
                read: docs/guides/test.md#error-is-a-refusal-or-an-invariant
            src/clock/instant.ts:8:19  jterrazz-check(error-is-a-refusal-or-an-invariant)
                found: \`docs/reference/time-and-doubles.md#instants\` names a heading no page has
                why: An error a user can cause — a verb misused, an option out of range, a path, a peer or a tool the machine lacks, a peer or a runtime breaking its own contract — is thrown as a refusal: \`new Error(refusal(…))\`, its four parts found · why · fix · read, the read a heading of the manual written in place that exists (\`docs/reference/time-and-doubles.md#the-clock\`) or a catalogue row.
                fix: read a heading that exists, and write the section that explains the refusal where none does
                read: docs/guides/test.md#error-is-a-refusal-or-an-invariant
        `);
    });
});
