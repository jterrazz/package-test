import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { MAKE_TARGETS, makefileAt, makeTargets } from './makefile.js';

const MOBILE_TARGET = 'test-mobile';

const BESIDE_TARGETS = [
    MOBILE_TARGET,
    'test-changed',
    'test-merge',
    'check-links',
    'mutation',
    'mutation-specs',
];

const ROOT = resolve(import.meta.dirname, '../../..');

describe('makefile', () => {
    test('the Makefile — the six targets a repository answers — this repository declares the six, and the six beside them, each phony', () => {
        // Given - this repository's Makefile
        const targets = makefileAt(ROOT);
        const verbs = [...MAKE_TARGETS, ...BESIDE_TARGETS].toSorted();

        // Then - the verbs are the six plus the six no flow speaks; the one other rule is the install stamp, a file
        expect(targets.get('.PHONY')?.prerequisites.toSorted()).toStrictEqual(verbs);
        expect(
            [...targets.keys()]
                .filter((name) => name !== '.PHONY' && !name.includes('/'))
                .toSorted(),
        ).toStrictEqual(verbs);
    });

    test('the Makefile — the six targets a repository answers — `check` never reaches a target beside the six', () => {
        // Given - the targets `check` runs, and what they run in turn
        const targets = makefileAt(ROOT);
        const reached = new Set<string>();
        const visit = (name: string): void => {
            const target = targets.get(name);
            if (target === undefined || reached.has(name)) {
                return;
            }
            reached.add(name);
            const called = target.recipe.flatMap((line) =>
                [...line.matchAll(/\$\(MAKE\)\s+(?<name>[\w-]+)/gu)].map(
                    (match) => match.groups?.name ?? '',
                ),
            );
            for (const next of [...target.prerequisites, ...called]) {
                visit(next);
            }
        };
        visit('check');

        // Then - no gate of CI's waits on a simulator, a partial run or a merge
        expect(BESIDE_TARGETS.filter((name) => reached.has(name))).toStrictEqual([]);
        expect(reached.has('test')).toBe(true);
    });

    test("the Makefile — the six targets a repository answers — `fix` builds first, for the checker it runs is this build's", () => {
        // Given - the fix target
        const fix = makefileAt(ROOT).get('fix');

        // Then - it stands on `build`, since `typescript fix` runs the conventions this build's `dist/checker.js` declares
        expect(fix?.prerequisites).toStrictEqual(['build']);
    });

    test('the Makefile — the six targets a repository answers — reads a rule, its recipe and its prerequisites, never an assignment', () => {
        // Given - a rule over a file target, a comment inside the recipe, and a variable
        const targets = makeTargets(
            [
                'SHELL := bash',
                '.PHONY: build',
                '',
                'build: node_modules/.install',
                '# the bundle',
                '\tnpm run build',
                '',
                'node_modules/.install: package-lock.json',
                '\tnpm ci',
                '',
            ].join('\n'),
        );

        // Then - three targets, each with what it runs
        expect([...targets.keys()]).toStrictEqual(['.PHONY', 'build', 'node_modules/.install']);
        expect(targets.get('build')).toStrictEqual({
            prerequisites: ['node_modules/.install'],
            recipe: ['npm run build'],
        });
    });
});
