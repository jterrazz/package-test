import { describe, expect, test } from 'vitest';

import { missingParts } from '../../../src/kernel/refusals/lesson.js';
import { lessonsAt, whyOf } from './lesson.js';
import type { Row } from './row.js';

const ROW: Row = {
    audience: 'consumer',
    channel: 'statique',
    convention: 'A test waits on a condition, never on the clock.',
    facet: 'model',
    family: 'world',
    fix: 'Wait on the condition.',
    name: 'no-sleep',
    rationale: 'A sleep is a guess.',
    reach: 'tests',
};

describe('lesson', () => {
    test.each([
        ['one sentence', 'A test waits on a condition.', 'A test waits on a condition.'],
        ['the first of two', 'A seed is SQL. Anything else is a fixture.', 'A seed is SQL.'],
        [
            'a period in a code span',
            'A `*.spec.ts` sits under `specs/`. Nothing else does.',
            'A `*.spec.ts` sits under `specs/`.',
        ],
        [
            'an abbreviation',
            'A token (e.g. `{{uuid}}`) is matched. Values are not.',
            'A token (e.g. `{{uuid}}`) is matched.',
        ],
        ['a lowercase continuation', 'It reads `x.ts`. then stops', 'It reads `x.ts`. then stops'],
    ])('whyOf — the convention in one sentence — %s', (_, convention, why) => {
        // Given - a catalogue sentence
        // Then - the why stops where the first sentence does
        expect(whyOf(convention)).toBe(why);
    });

    test('every message teaches: found, why, fix, read (meta-test) — `message-has-four-parts` — a message lacking a part is refused, naming the part', () => {
        // Given - a rule whose fix was left empty, and one written as a plain sentence
        const withoutFix = lessonsAt(ROW, { sleep: { fix: '', found: 'a sleep' } }).sleep;

        // Then - the meta-test's reader names what each one lacks
        expect(missingParts(withoutFix)).toStrictEqual(['fix']);
        expect(missingParts('No arbitrary sleep in a test.')).toStrictEqual([
            'found',
            'why',
            'fix',
            'read',
        ]);
    });
});
