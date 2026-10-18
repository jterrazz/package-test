import { describe, expect, test } from 'vitest';

import { refusal } from '../refusal.js';
import { scenarioFailure } from '../scenario-failure.js';

const AMBIGUOUS = refusal({
    fix: 'designate one of them',
    found: 'button("Save") matched 2 elements',
    read: 'docs/guides/website-specs.md#visit-scenarios-the-when',
    why: 'A target names one element.',
});

describe('scenarioFailure', () => {
    test('scenarioFailure — a finished refusal — is passed through, its evidence closing its found and its read still last', () => {
        // Given - a step that failed on a finished refusal, and a screenshot taken
        const failure = scenarioFailure(new Error(AMBIGUOUS), '/tmp/evidence/page.png', 'visit');

        // Then - the four parts in their order, the evidence inside the found
        expect(failure.message).toBe(
            [
                'found: button("Save") matched 2 elements\nEvidence: /tmp/evidence/page.png',
                'why: A target names one element.',
                'fix: designate one of them',
                'read: docs/guides/website-specs.md#visit-scenarios-the-when',
            ].join('\n'),
        );
    });

    test('scenarioFailure — any other error — is wrapped, indented, in the lesson of the scenario it ended', () => {
        // Given - a step that failed on a message of two lines, and no evidence
        const failure = scenarioFailure(new Error('tap failed\nno such element'), null, 'open');

        // Then - the open scenario's lesson, the original message indented under its found
        expect(failure.message).toBe(
            [
                'found: the open scenario failed:\n  tap failed\n  no such element',
                'why: An open scenario drives the screen step by step, and the first step that fails ends it.',
                'fix: correct the step that failed, or the screen it drives',
                'read: docs/guides/mobile-specs.md#open-scenarios-the-when',
            ].join('\n'),
        );
    });

    test("scenarioFailure — a bare value thrown — is wrapped in the visit scenario's lesson with its evidence, and kept as the cause", () => {
        // Given - a step that threw a bare string, and a screenshot taken
        const failure = scenarioFailure('boom', '/tmp/evidence/page.png', 'visit');

        // Then - the visit scenario's lesson, the value as its text, the evidence closing the found
        expect([failure.message, failure.cause]).toStrictEqual([
            [
                'found: the visit scenario failed:\n  boom\nEvidence: /tmp/evidence/page.png',
                'why: A visit scenario drives the page step by step, and the first step that fails ends it.',
                'fix: correct the step that failed, or the page it drives',
                'read: docs/guides/website-specs.md#visit-scenarios-the-when',
            ].join('\n'),
            'boom',
        ]);
    });

    test('scenarioFailure — a refusal missing a part, or read elsewhere than a chapter — is no finished lesson, and is wrapped', () => {
        // Given - refusals lacking their why, their fix, their found, one whose read is no chapter anchor, and one whose read runs past its anchor onto another line
        const parts = {
            found: 'found: two matched',
            why: 'why: one element',
            fix: 'fix: designate one of them',
            read: 'read: docs/guides/website-specs.md#a',
        };
        const without = (part: keyof typeof parts): string =>
            Object.entries(parts)
                .filter(([name]) => name !== part)
                .map(([, line]) => line)
                .join('\n');

        // Then - each is wrapped, its message indented under the scenario's found
        expect(
            [
                without('why'),
                without('fix'),
                without('found'),
                `${without('read')}\nread: see docs/guides/website-specs.md#a`,
                `${without('read')}\nread: docs/guides/website-specs.md#a\nand a line after it`,
            ].map(
                (message) =>
                    scenarioFailure(new Error(message), null, 'visit').message.split('\n')[0],
            ),
        ).toStrictEqual([
            'found: the visit scenario failed:',
            'found: the visit scenario failed:',
            'found: the visit scenario failed:',
            'found: the visit scenario failed:',
            'found: the visit scenario failed:',
        ]);
    });
});
