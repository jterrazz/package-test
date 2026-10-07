import {
    firstSentence,
    lessonOf,
    lessonParts,
    missingParts,
    readAt,
} from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { refusal } from '../../../../src/chain/refusals/refusal.js';
import { REFUSAL_WHY, RUNTIME_RULES } from '../../../../src/chain/refusals/rows.js';
import type { RefusalRow } from '../../../../src/chain/refusals/rows.js';
import { CHECKER_PASS_IDS } from '../../../consumer/checks/checker.js';
import plugin from '../../../consumer/rules/plugin.js';
import { SELF_CHECKER_PASS_IDS } from '../../checks/checker.js';
import selfPlugin from '../../rules/plugin.js';
import { chapterOf, goldenCheckerLines, ROOT, rowNamed, sourcesUnder } from '../messages.js';

describe('messages', () => {
    test('`message-has-four-parts` — every message of a static rule states the four parts, its why and read its row’s', () => {
        // Given - every message the shipped plugin can print, before oxlint fills its data
        const messages = Object.entries({ ...plugin.rules, ...selfPlugin.rules }).flatMap(
            ([name, rule]) =>
                Object.entries(rule.meta?.messages ?? {}).map(([key, message]) => ({
                    convention: rule.meta?.docs?.sentence ?? '',
                    key,
                    message,
                    name,
                })),
        );
        expect(messages.length).toBeGreaterThan(50);

        // Then - no part is missing, and the row's own sentence and heading are the ones it states
        expect(
            messages
                .filter(
                    ({ convention, message, name }) =>
                        missingParts(message).length > 0 ||
                        lessonParts(message)?.why !== firstSentence(convention) ||
                        lessonParts(message)?.read !== readAt(rowNamed(name), chapterOf(name)),
                )
                .map(({ key, name }) => `${name}.${key}`),
        ).toStrictEqual([]);
    });

    test('`message-has-four-parts` — every checker pass renders a whole lesson from its row', () => {
        // Given - one finding of each pass a checker runs, the published one and this package's own
        const passes = [...CHECKER_PASS_IDS, ...SELF_CHECKER_PASS_IDS];
        expect(passes.length).toBeGreaterThan(5);

        // Then - the row's sentence and heading fill the two parts a finding does not write
        expect(
            passes.filter((pass) => {
                const message = lessonOf(rowNamed(pass), readAt(rowNamed(pass), chapterOf(pass)), {
                    fix: 'the gesture',
                    found: 'the finding',
                });
                return (
                    missingParts(message).length > 0 ||
                    lessonParts(message)?.why !== firstSentence(rowNamed(pass).sentence)
                );
            }),
        ).toStrictEqual([]);
    });

    test('`message-has-four-parts` — every checker finding a spec goldens is a whole lesson', () => {
        // Given - the reports the lint specification goldens, and the full-output goldens of the checker's own command line
        const lines = [
            ...goldenCheckerLines(resolve(ROOT, 'specs/lint')),
            ...goldenCheckerLines(resolve(ROOT, 'specs/cli')),
        ];

        // Then - each line the checker printed states the four parts
        expect(lines.length).toBeGreaterThan(20);
        expect(lines.filter((message) => missingParts(message).length > 0)).toStrictEqual([]);
    });

    test('`message-has-four-parts` — every refusal of the runtime opens on its row’s sentence, and is thrown somewhere', () => {
        // Given - the runtime rows that refuse, and the source that throws them
        const source = sourcesUnder(resolve(ROOT, 'src'));
        const rows = Object.keys(REFUSAL_WHY).filter(
            (row): row is RefusalRow => row in REFUSAL_WHY,
        );
        expect(rows.length).toBeGreaterThan(0);

        // Then - each row exists, opens on the refusal's why, is thrown by a module, and states four parts
        expect(
            rows.flatMap((row) => {
                const entry = RUNTIME_RULES.find((rule) => rule.name === row);
                return [
                    entry?.channel === 'runtime' ? null : `${row} is no runtime row`,
                    firstSentence(entry?.sentence ?? '') === REFUSAL_WHY[row]
                        ? null
                        : `${row} opens on another sentence than its why`,
                    source.includes(`refusal('${row}'`) ? null : `${row} is thrown by no module`,
                    missingParts(refusal(row, { fix: 'the gesture', found: 'the case' })).length ===
                    0
                        ? null
                        : `${row} misses a part`,
                ].filter((broken) => broken !== null);
            }),
        ).toStrictEqual([]);
    });
});
