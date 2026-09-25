import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { lessonParts, missingParts } from '../src/model/lesson/lesson.js';
import { refusal, REFUSAL_WHY } from '../src/model/lesson/refusal.js';
import type { RefusalRow } from '../src/model/lesson/refusal.js';
import { CHECKER_PASS_IDS } from './checker.js';
import { lessonOf, lessons, readOf, whyOf } from './lesson.js';
import { CHECKER_PASSES, RUNTIME_RULES } from './manifest.js';
import plugin from './plugin.js';
import { SELF_PASS_IDS } from './self-checker.js';

const ROOT = resolve(import.meta.dirname, '..');

/** A checker line as the report prints it: the lesson after the code. */
const CHECKER_LINE = /^\S+:\d+:\d+: (?:error|warning) jterrazz-check\([\w-]+\): (?<message>.*)$/u;

/** Every checker finding a spec of `specs/lint/checker/` goldens whole. */
function goldenCheckerLines(): string[] {
    const dir = resolve(ROOT, 'specs/lint/checker');
    const lines: string[] = [];
    for (const entry of readdirSync(dir, { recursive: true })) {
        const path = String(entry);
        if (path.includes('fixtures') || !/\.(?:test\.ts|txt)$/u.test(path)) {
            continue;
        }
        for (const line of readFileSync(resolve(dir, path), 'utf8').split('\n')) {
            const message = CHECKER_LINE.exec(line.trim())?.groups?.message;
            if (message !== undefined) {
                lines.push(message);
            }
        }
    }
    return lines;
}

/** Every module under `dir`, concatenated — where a refusal is thrown. */
function sourcesUnder(dir: string): string {
    return readdirSync(dir, { recursive: true })
        .map(String)
        .filter((path) => path.endsWith('.ts') && !/\.test(?:-d)?\.tsx?$/u.test(path))
        .map((path) => readFileSync(resolve(dir, path), 'utf8'))
        .join('\n');
}

describe('whyOf — the convention in one sentence', () => {
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
    ])('%s', (_, convention, why) => {
        // Given - a catalogue sentence
        // Then - the why stops where the first sentence does
        expect(whyOf(convention)).toBe(why);
    });
});

describe('k11 — every message teaches: found, why, fix, read (meta-test)', () => {
    test('k11 — every message of a static rule states the four parts, its why and read its row’s', () => {
        // Given - every message the shipped plugin can print, before oxlint fills its data
        for (const [name, rule] of Object.entries(plugin.rules)) {
            const convention = rule.meta?.docs?.convention ?? '';
            for (const [key, message] of Object.entries(rule.meta?.messages ?? {})) {
                // Then - no part is missing, and the row's own sentence and heading are the ones it states
                expect(missingParts(message), `${name}.${key}`).toStrictEqual([]);
                expect(lessonParts(message)?.why, `${name}.${key}`).toBe(whyOf(convention));
                expect(lessonParts(message)?.read, `${name}.${key}`).toBe(readOf(name));
            }
        }
    });

    test('k11 — every checker pass renders a whole lesson from its row', () => {
        // Given - one finding of each pass a checker runs, the published one and this package's own
        for (const pass of [...CHECKER_PASS_IDS, ...SELF_PASS_IDS]) {
            const message = lessonOf(pass, { fix: 'the gesture', found: 'the finding' });

            // Then - the row's sentence and heading fill the two parts a finding does not write
            expect(missingParts(message)).toStrictEqual([]);
            expect(lessonParts(message)?.why).toBe(
                whyOf(CHECKER_PASSES.find((row) => row.name === pass)?.convention ?? ''),
            );
        }
    });

    test('k11 — every checker finding a spec goldens is a whole lesson', () => {
        // Given - the full-output goldens of the checker's own specs
        const lines = goldenCheckerLines();

        // Then - each line the checker printed states the four parts
        expect(lines.length).toBeGreaterThan(20);
        for (const message of lines) {
            expect(missingParts(message)).toStrictEqual([]);
        }
    });

    test('k11 — every refusal of the runtime opens on its row’s sentence, and is thrown somewhere', () => {
        // Given - the runtime rows that refuse, and the source that throws them
        const source = sourcesUnder(resolve(ROOT, 'src'));
        for (const [row, why] of Object.entries(REFUSAL_WHY)) {
            const entry = RUNTIME_RULES.find((rule) => rule.name === row);

            // Then - the row exists, opens on the refusal's why, and a module throws it
            expect(entry?.channel).toBe('runtime');
            expect(whyOf(entry?.convention ?? '')).toBe(why);
            expect(source).toContain(`refusal('${row}'`);
            expect(
                missingParts(refusal(row as RefusalRow, { fix: 'the gesture', found: 'the case' })),
            ).toStrictEqual([]);
        }
    });

    test('k11 — a message lacking a part is refused, naming the part', () => {
        // Given - a rule whose fix was left empty, and one written as a plain sentence
        const withoutFix = lessons('j2-no-sleep', { sleep: { fix: '', found: 'a sleep' } }).sleep;

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
