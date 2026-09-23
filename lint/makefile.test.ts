import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { MAKE_TARGETS, makefileAt, makeTargets } from './makefile.js';

/** The repository root, from this module's place inside `lint/`. */
const ROOT = resolve(import.meta.dirname, '..');

describe('the Makefile — the six targets a repository answers', () => {
    test('this repository declares exactly the six, each phony', () => {
        // Given - this repository's Makefile
        const targets = makefileAt(ROOT);

        // Then - the verbs are the six and no seventh; the one other rule is the install stamp, a file
        expect(targets.get('.PHONY')?.prerequisites.toSorted()).toStrictEqual(
            [...MAKE_TARGETS].toSorted(),
        );
        expect(
            [...targets.keys()]
                .filter((name) => name !== '.PHONY' && !name.includes('/'))
                .toSorted(),
        ).toStrictEqual([...MAKE_TARGETS].toSorted());
    });

    test('`fix` runs the two fixers and nothing else', () => {
        // Given - the fix target, over the build its checker is run from
        const fix = makefileAt(ROOT).get('fix');

        // Then - the toolchain's fixer, then the checker's; no verdict after them
        expect(fix?.prerequisites).toStrictEqual(['build']);
        expect(fix?.recipe).toStrictEqual(['npx typescript fix', 'node dist/checker.js --fix']);
    });

    test('reads a rule, its recipe and its prerequisites, never an assignment', () => {
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
