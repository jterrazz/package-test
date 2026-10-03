import { execFileSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import { checkNamedPathExists } from './named-path-exists.js';

const SPEC = [
    "test('reads', async () => {",
    "    await api.fixture(file('./_fixtures/present.json'));",
    "    await api.fixture(file('./_fixtures/missing.json'));",
    "    await api.fixture(directory('./_fixtures/present.json'));",
    "    await api.fixture(file('./_fixtures/app/'));",
    "    await api.fixture(file('./_fixtures/app'));",
    '    const quoted = "file(\'./_fixtures/quoted.json\')";',
    "    const root = resolve(import.meta.dirname, '../gone', 'x.txt');",
    "    const here = resolve(import.meta.dirname, './_fixtures', 'present.json');",
    '    // checker-disable-next-line named-path-exists -- written by the run',
    "    await api.fixture(file('./_fixtures/later.json'));",
    '    // checker-disable-next-line named-path-exists -- written by the run',
    "    const later = resolve(import.meta.dirname, './_fixtures', 'later.json');",
    "    await api.fixture(file('./_fixtures/ignored.json'));",
    '});',
    '',
].join('\n');

const DOCUMENT = [
    'description: lays its fixtures',
    'fixture:',
    '    - ./_fixtures/app/',
    '    - ./_fixtures/present.json/',
    '    - ./_fixtures/app',
    '    - ./_fixtures/gone.json',
    'runs:',
    '    - command: build',
    '      exit: 0',
    '',
].join('\n');

describe('named-path-exists', () => {
    test('a path a spec names is found when nothing, the other kind, or an ignored file is there', () => {
        // Given - a git checkout whose spec and document name present, missing, crossed, silenced and ignored paths
        const root = packageWith({
            '.gitignore': 'specs/api/_fixtures/ignored.json\n',
            'specs/api/_fixtures/app/index.html': '<p></p>\n',
            'specs/api/_fixtures/ignored.json': '{}\n',
            'specs/api/_fixtures/present.json': '{}\n',
            'specs/api/case.spec.yaml': DOCUMENT,
            'specs/api/users.spec.ts': SPEC,
        });
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        execFileSync('git', ['add', '.'], { cwd: root });

        // Then - each path that names nothing or the wrong kind, with its fix
        expect(
            checkNamedPathExists(root).map(
                ({ column, fix, found, line, path, rule }) =>
                    `${rule} ${path}:${line}:${column} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'named-path-exists specs/api/case.spec.yaml:4:1 fixture: "./_fixtures/present.json/" names a file — write "./_fixtures/present.json"',
            'named-path-exists specs/api/case.spec.yaml:5:1 fixture: "./_fixtures/app" names a directory — write "./_fixtures/app/"',
            'named-path-exists specs/api/case.spec.yaml:6:1 fixture: "./_fixtures/gone.json" names nothing — specs/api/_fixtures/gone.json does not exist — create specs/api/_fixtures/gone.json, or correct the path',
            "named-path-exists specs/api/users.spec.ts:8:47 '../gone', 'x.txt' names nothing — specs/gone/x.txt does not exist — create specs/gone/x.txt, or correct the path",
            "named-path-exists specs/api/users.spec.ts:3:28 file('./_fixtures/missing.json') names nothing — specs/api/_fixtures/missing.json does not exist — create specs/api/_fixtures/missing.json, or correct the path",
            "named-path-exists specs/api/users.spec.ts:4:33 directory('./_fixtures/present.json') names a file — write file('./_fixtures/present.json')",
            "named-path-exists specs/api/users.spec.ts:5:28 file('./_fixtures/app/') names a directory — write directory('./_fixtures/app/')",
            "named-path-exists specs/api/users.spec.ts:6:28 file('./_fixtures/app') names a directory — write directory('./_fixtures/app/')",
            "named-path-exists specs/api/users.spec.ts:14:28 file('./_fixtures/ignored.json') names nothing — specs/api/_fixtures/ignored.json is ignored by git — track specs/api/_fixtures/ignored.json (it is ignored by git), or name a file that is",
        ]);
    });
});
