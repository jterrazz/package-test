import { describe, expect, test } from 'vitest';

import { refusal } from './refusal.js';
import { scenarioFailure } from './scenario-failure.js';

const AMBIGUOUS = refusal({
    fix: 'designate one of them',
    found: 'button("Save") matched 2 elements',
    read: 'docs/10-website.md#visit-scenarios--the-when',
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
                'read: docs/10-website.md#visit-scenarios--the-when',
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
                'read: docs/11-mobile.md#open-scenarios--the-when',
            ].join('\n'),
        );
    });
});
