import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

    test("`fix` builds first, for the checker it runs is this build's", () => {
        // Given - the fix target
        const fix = makefileAt(ROOT).get('fix');

        // Then - it stands on `build`, since `dist/checker.js` is what the checker's fixer runs
        expect(fix?.prerequisites).toStrictEqual(['build']);
    });

    test.each([
        { checker: 0, toolchain: 1 },
        { checker: 1, toolchain: 0 },
        { checker: 0, toolchain: 0 },
    ])(
        '`fix` runs both fixers whatever each says, and fails when either did ($toolchain, $checker)',
        ({ checker, toolchain }) => {
            // Given - the two fixers stood in for by stubs that log their call and exit as told
            const bin = mkdtempSync(join(tmpdir(), 'makefile-fix-'));
            const log = join(bin, 'calls.log');
            for (const [command, status] of [
                ['npx', toolchain],
                ['node', checker],
            ] as const) {
                writeFileSync(
                    join(bin, command),
                    `#!/bin/sh\necho "${command} $*" >> "${log}"\nexit ${status}\n`,
                );
                chmodSync(join(bin, command), 0o755);
            }

            // When - `make fix`, its build taken as done
            const run = spawnSync(
                'make',
                ['-s', '-o', 'build', '-f', join(ROOT, 'Makefile'), 'fix'],
                {
                    cwd: bin,
                    encoding: 'utf8',
                    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
                },
            );

            // Then - both fixers ran, the formatter's last so it formats what the checker wrote, and the verdict is theirs combined
            expect(readFileSync(log, 'utf8')).toBe(
                'node dist/checker.js --fix\nnpx typescript fix\n',
            );
            expect(run.status === 0).toBe(toolchain === 0 && checker === 0);
        },
    );

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
