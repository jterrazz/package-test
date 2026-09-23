import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runAllChecks } from './checker.js';
import { trackedNames } from './tracked.js';

/** A document whose name only repeats its directory — a C12 finding wherever it is read. */
const REPEATED_NAME = [
    'description: names its directory again instead of naming the case',
    'runs:',
    '    - command: widget rm',
    '      exit: 0',
    '      stdout: |',
    '          Removed.',
    '',
].join('\n');

/** A project on disk holding `files`, `git init`ed when `git` names what to add. */
function project(files: string[], git?: { add: string[] }): string {
    const root = mkdtempSync(join(tmpdir(), 'tracked-'));
    for (const path of files) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), REPEATED_NAME);
    }
    if (git !== undefined) {
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        execFileSync('git', ['add', ...git.add], { cwd: root });
    }
    return root;
}

/** The files of the C12 findings a run over `<root>/specs` reports. */
function c12Files(root: string): string[] {
    return runAllChecks(join(root, 'specs'))
        .filter(({ rule }) => rule === 'c12')
        .map(({ file }) => file)
        .toSorted();
}

describe('the tracked listing the checker walks', () => {
    test('reports a tracked document, and never an untracked one', () => {
        // Given - two documents repeating their directory, one of them added to git
        const root = project(['specs/cp/cp.spec.yaml', 'specs/rm/rm.spec.yaml'], {
            add: ['specs/rm/rm.spec.yaml'],
        });

        // Then - the finding the clean checkout would report, and only it
        expect(c12Files(root)).toStrictEqual(['rm/rm.spec.yaml']);
    });

    test('walks the disk where git places the directory in no work tree', () => {
        // Given - the same two documents, and no repository
        const root = project(['specs/cp/cp.spec.yaml', 'specs/rm/rm.spec.yaml']);

        // Then - both are read
        expect(c12Files(root)).toStrictEqual(['cp/cp.spec.yaml', 'rm/rm.spec.yaml']);
    });

    test('walks the disk under a hand-made `.git` folder git does not recognise', () => {
        // Given - a `.git` directory holding no repository
        const root = project(['specs/rm/rm.spec.yaml']);
        mkdirSync(join(root, '.git'));

        // Then - the disk answers
        expect(trackedNames(join(root, 'specs'))).toStrictEqual(['rm']);
    });

    test('lists nothing under a directory that holds no tracked file', () => {
        // Given - a repository tracking one document, and an untracked folder beside it
        const root = project(['specs/cp/cp.spec.yaml', 'specs/rm/rm.spec.yaml'], {
            add: ['specs/rm/rm.spec.yaml'],
        });

        // Then - the folder is there on disk and empty to the walk
        expect(trackedNames(join(root, 'specs', 'cp'))).toStrictEqual([]);
        expect(trackedNames(join(root, 'specs'))).toStrictEqual(['rm']);
    });

    test('throws on a directory that is not there, as the disk does', () => {
        // Given - a repository, and a path inside it that names nothing
        const root = project(['specs/rm/rm.spec.yaml'], { add: ['specs'] });

        // Then - a missing directory is not an empty one
        expect(() => trackedNames(join(root, 'specs', 'gone'))).toThrow(/ENOENT/u);
    });
});
