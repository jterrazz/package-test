import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { fixPoolFixtures } from './checker-crossfile.js';
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

/** A tree whose pool holds `app/`, reached from the one leaf `specs/api/`. */
function singleReaderPool(git: boolean): string {
    const root = mkdtempSync(join(tmpdir(), 'tracked-c14-'));
    mkdirSync(join(root, 'specs', 'fixtures', 'app'), { recursive: true });
    mkdirSync(join(root, 'specs', 'api'), { recursive: true });
    writeFileSync(join(root, 'specs', 'fixtures', 'app', 'index.txt'), 'app\n');
    writeFileSync(
        join(root, 'specs', 'api', 'boot.spec.ts'),
        "await api.fixture(directory('../fixtures/app/')).get('/');\n",
    );
    if (git) {
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        execFileSync('git', ['add', '.'], { cwd: root });
    }
    return root;
}

describe('the moves the fixers make', () => {
    test('keeps a fixture C14 moves tracked in a git checkout', () => {
        // Given - a tracked single-reader pool fixture
        const root = singleReaderPool(true);

        // When - the fixer moves it beside its leaf
        fixPoolFixtures(join(root, 'specs'));

        // Then - the index holds the new path and not the old one
        const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
        expect(tracked.split('\n').filter(Boolean).toSorted()).toStrictEqual([
            'specs/api/boot.spec.ts',
            'specs/api/fixtures/app/index.txt',
        ]);
    });

    test('moves a C14 fixture by plain rename where git places the tree in no work tree', () => {
        // Given - the same tree, and no repository
        const root = singleReaderPool(false);

        // When - the fixer moves it beside its leaf
        fixPoolFixtures(join(root, 'specs'));

        // Then - the disk holds it at its new place only
        expect(existsSync(join(root, 'specs', 'api', 'fixtures', 'app', 'index.txt'))).toBe(true);
        expect(existsSync(join(root, 'specs', 'fixtures', 'app'))).toBe(false);
    });
});
