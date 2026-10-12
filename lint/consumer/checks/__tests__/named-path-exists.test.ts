import { execFileSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkNamedPathExists } from '../named-path-exists.js';

const SPEC = [
    "test('reads', async () => {",
    "    await api.fixture(file('./__fixtures__/present.json'));",
    "    await api.fixture(file('./__fixtures__/missing.json'));",
    "    await api.fixture(directory('./__fixtures__/present.json'));",
    "    await api.fixture(file('./__fixtures__/app/'));",
    "    await api.fixture(file('./__fixtures__/app'));",
    '    const quoted = "file(\'./__fixtures__/quoted.json\')";',
    "    const root = resolve(import.meta.dirname, '../gone', 'x.txt');",
    "    const here = resolve(import.meta.dirname, './__fixtures__', 'present.json');",
    '    // checker-disable-next-line named-path-exists -- written by the run',
    "    await api.fixture(file('./__fixtures__/later.json'));",
    '    // checker-disable-next-line named-path-exists -- written by the run',
    "    const later = resolve(import.meta.dirname, './__fixtures__', 'later.json');",
    "    await api.fixture(file('./__fixtures__/ignored.json'));",
    '});',
    '',
].join('\n');

const DOCUMENT = [
    'description: lays its fixtures',
    'fixture:',
    '    - ./__fixtures__/app/',
    '    - ./__fixtures__/present.json/',
    '    - ./__fixtures__/app',
    '    - ./__fixtures__/gone.json',
    'runs:',
    '    - command: build',
    '      exit: 0',
    '',
].join('\n');

describe('named-path-exists', () => {
    test('a path a spec names is found when nothing, the other kind, or an ignored file is there', () => {
        // Given - a git checkout whose spec and document name present, missing, crossed, silenced and ignored paths
        const root = packageWith({
            '.gitignore': 'specs/api/__fixtures__/ignored.json\n',
            'specs/api/__fixtures__/app/index.html': '<p></p>\n',
            'specs/api/__fixtures__/ignored.json': '{}\n',
            'specs/api/__fixtures__/present.json': '{}\n',
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
            'named-path-exists specs/api/case.spec.yaml:4:1 fixture: "./__fixtures__/present.json/" names a file — write "./__fixtures__/present.json"',
            'named-path-exists specs/api/case.spec.yaml:5:1 fixture: "./__fixtures__/app" names a directory — write "./__fixtures__/app/"',
            'named-path-exists specs/api/case.spec.yaml:6:1 fixture: "./__fixtures__/gone.json" names nothing — specs/api/__fixtures__/gone.json does not exist — create specs/api/__fixtures__/gone.json, or correct the path',
            "named-path-exists specs/api/users.spec.ts:8:47 '../gone', 'x.txt' names nothing — specs/gone/x.txt does not exist — create specs/gone/x.txt, or correct the path",
            "named-path-exists specs/api/users.spec.ts:3:28 file('./__fixtures__/missing.json') names nothing — specs/api/__fixtures__/missing.json does not exist — create specs/api/__fixtures__/missing.json, or correct the path",
            "named-path-exists specs/api/users.spec.ts:4:33 directory('./__fixtures__/present.json') names a file — write file('./__fixtures__/present.json')",
            "named-path-exists specs/api/users.spec.ts:5:28 file('./__fixtures__/app/') names a directory — write directory('./__fixtures__/app/')",
            "named-path-exists specs/api/users.spec.ts:6:28 file('./__fixtures__/app') names a directory — write directory('./__fixtures__/app/')",
            "named-path-exists specs/api/users.spec.ts:14:28 file('./__fixtures__/ignored.json') names nothing — specs/api/__fixtures__/ignored.json is ignored by git — track specs/api/__fixtures__/ignored.json (it is ignored by git), or name a file that is",
        ]);
    });

    test('a path under the build output of the unit is named without existing yet, in a spec and in its specification, and a path beside it is not', () => {
        // Given - a spec and a specification naming the built binary, the bundled entry, another tool's artefact, a look-alike folder and a missing source
        const root = packageWith({
            'specs/cli/cli.specification.ts': [
                "const built = resolve(import.meta.dirname, '../../dist', 'index.js');",
                "const binary = resolve(import.meta.dirname, '../../.artifacts/go', 'spwn');",
                "const lookalike = resolve(import.meta.dirname, '../../distribution', 'index.js');",
                '',
            ].join('\n'),
            'dist/index.js': 'built\n',
            'specs/cli/run.spec.ts': [
                "test('runs', async () => {",
                "    await cli.fixture(file('../../dist/index.js'));",
                "    await cli.fixture(directory('../../dist/index.js'));",
                "    await cli.fixture(file('../../.artifacts/go/spwn'));",
                "    await cli.fixture(file('../../.artifacts/spwn'));",
                '});',
                '',
            ].join('\n'),
        });

        // Then - the look-alike folder, an artefact with no tool folder, and a built file named as a directory are the only paths found wrong
        expect(
            checkNamedPathExists(root).map(({ line, path }) => `${path}:${String(line)}`),
        ).toStrictEqual([
            'specs/cli/cli.specification.ts:3',
            'specs/cli/run.spec.ts:3',
            'specs/cli/run.spec.ts:5',
        ]);
    });
});
