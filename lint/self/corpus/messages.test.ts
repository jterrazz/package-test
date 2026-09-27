import {
    firstSentence,
    lessonOf,
    lessonParts,
    missingParts,
    readAt,
} from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RUNTIME_RULES } from '../../consumer/catalogue/manifest.js';
import { REFUSAL_WHY } from '../../consumer/catalogue/refusals.js';
import type { RefusalRow } from '../../consumer/catalogue/refusals.js';
import { CHECKER_PASS_IDS } from '../../consumer/checks/checker.js';
import plugin from '../../consumer/rules/plugin.js';
import { refusal } from '../../index.refusal.js';
import { SELF_CHECKER_PASS_IDS } from '../checks/checker.js';
import selfPlugin from '../rules/plugin.js';
import { chapterOf, goldenCheckerLines, ROOT, rowNamed, sourcesUnder } from './messages.js';

describe('messages', () => {
    test('`message-has-four-parts` — every message of a static rule states the four parts, its why and read its row’s', () => {
        // Given - every message the shipped plugin can print, before oxlint fills its data
        for (const [name, rule] of Object.entries({ ...plugin.rules, ...selfPlugin.rules })) {
            const convention = rule.meta?.docs?.sentence ?? '';
            for (const [key, message] of Object.entries(rule.meta?.messages ?? {})) {
                // Then - no part is missing, and the row's own sentence and heading are the ones it states
                expect(missingParts(message), `${name}.${key}`).toStrictEqual([]);
                expect(lessonParts(message)?.why, `${name}.${key}`).toBe(firstSentence(convention));
                expect(lessonParts(message)?.read, `${name}.${key}`).toBe(
                    readAt(rowNamed(name), chapterOf(name)),
                );
            }
        }
    });

    test('`message-has-four-parts` — every checker pass renders a whole lesson from its row', () => {
        // Given - one finding of each pass a checker runs, the published one and this package's own
        for (const pass of [...CHECKER_PASS_IDS, ...SELF_CHECKER_PASS_IDS]) {
            const message = lessonOf(rowNamed(pass), readAt(rowNamed(pass), chapterOf(pass)), {
                fix: 'the gesture',
                found: 'the finding',
            });

            // Then - the row's sentence and heading fill the two parts a finding does not write
            expect(missingParts(message)).toStrictEqual([]);
            expect(lessonParts(message)?.why).toBe(firstSentence(rowNamed(pass).sentence));
        }
    });

    test('`message-has-four-parts` — every checker finding a spec goldens is a whole lesson', () => {
        // Given - the reports the lint facet goldens, and the full-output goldens of the checker's own command line
        const lines = [
            ...goldenCheckerLines(resolve(ROOT, 'specs/lint')),
            ...goldenCheckerLines(resolve(ROOT, 'specs/cli')),
        ];

        // Then - each line the checker printed states the four parts
        expect(lines.length).toBeGreaterThan(20);
        for (const message of lines) {
            expect(missingParts(message)).toStrictEqual([]);
        }
    });

    test('`message-has-four-parts` — every refusal of the runtime opens on its row’s sentence, and is thrown somewhere', () => {
        // Given - the runtime rows that refuse, and the source that throws them
        const source = sourcesUnder(resolve(ROOT, 'src'));
        for (const [row, why] of Object.entries(REFUSAL_WHY)) {
            const entry = RUNTIME_RULES.find((rule) => rule.name === row);

            // Then - the row exists, opens on the refusal's why, and a module throws it
            expect(entry?.channel).toBe('runtime');
            expect(firstSentence(entry?.sentence ?? '')).toBe(why);
            expect(source).toContain(`refusal('${row}'`);
            expect(
                missingParts(refusal(row as RefusalRow, { fix: 'the gesture', found: 'the case' })),
            ).toStrictEqual([]);
        }
    });
});
