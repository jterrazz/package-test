import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { moveKeepingHistory } from '../src/kernel/files/git-tree.js';
import { fixPoolFixtures } from './checker-crossfile.js';
import { readManifest } from './checker-member.js';
import { migrateTo17 } from './checker-migration.js';
import { checkSpecOutsideSpecs } from './checker-placement.js';
import {
    checkConventionFiles,
    findKnownTokens,
    findUnknownTokens,
    formatViolations,
    runAllChecks,
} from './checker.js';
import { codeOf } from './rule-code.js';

const FIXTURES = resolve(import.meta.dirname, '../specs/lint/checker/fixtures/lint-violations');

const REPEATED_NAME = [
    'description: names its directory again instead of naming the case',
    'runs:',
    '    - command: widget rm',
    '      exit: 0',
    '      stdout: |',
    '          Removed.',
    '',
].join('\n');
function repository(files: string[], add: string[], ignore = ''): string {
    const root = mkdtempSync(join(tmpdir(), 'checker-tree-'));
    for (const path of files) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), path.endsWith('.spec.yaml') ? REPEATED_NAME : `${path}\n`);
    }
    writeFileSync(join(root, '.gitignore'), ignore);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    if (add.length > 0) {
        execFileSync('git', ['add', ...add], { cwd: root });
    }
    return root;
}
function findings(root: string, rule: string): string[] {
    return runAllChecks(join(root, 'specs'))
        .filter((violation) => violation.rule === rule || codeOf(violation.rule) === rule)
        .map((violation) => `${violation.file}:${violation.line}: ${violation.found}`)
        .toSorted();
}
function singleReaderPool(git: boolean): string {
    const root = mkdtempSync(join(tmpdir(), 'checker-c14-'));
    mkdirSync(join(root, 'specs', 'shared', 'fixtures', 'app'), { recursive: true });
    mkdirSync(join(root, 'specs', 'api'), { recursive: true });
    writeFileSync(join(root, 'specs', 'shared', 'fixtures', 'app', 'index.txt'), 'app\n');
    writeFileSync(
        join(root, 'specs', 'api', 'boot.spec.ts'),
        "await api.fixture(directory('../shared/fixtures/app/')).get('/');\n",
    );
    if (git) {
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        execFileSync('git', ['add', '.'], { cwd: root });
    }
    return root;
}
describe('checker', () => {
    test('conventions checker — findUnknownTokens (D4) — flags an identifier-shaped token outside the vocabulary', () => {
        // Given - a fixture line with one unknown and one known token
        const violations = findUnknownTokens('user {{userid}} created at {{iso8601}}');

        // Then - only the unknown token is reported, with its line
        expect(violations).toStrictEqual([{ line: 1, token: '{{userid}}' }]);
    });

    test('conventions checker — findUnknownTokens (D4) — accepts every known token, with and without capture refs', () => {
        // Given - a sample of the frozen vocabulary
        const text = '{{uuid}} {{uuid#id}} {{iso8601}} {{workdir}} {{any}} {{int#count}}';

        // Then - clean
        expect(findUnknownTokens(text)).toStrictEqual([]);
    });

    test('conventions checker — findUnknownTokens (D4) — flags a malformed ref on a known kind (empty ref, spaced)', () => {
        // Given - two malformed captures of otherwise-known kinds
        // Then - both are reported (they are not well-formed tokens)
        expect(findUnknownTokens('{{iso8601#}}')).toStrictEqual([
            { line: 1, token: '{{iso8601#}}' },
        ]);
        expect(findUnknownTokens('{{uuid #id}}')).toStrictEqual([
            { line: 1, token: '{{uuid #id}}' },
        ]);
    });

    test('conventions checker — findUnknownTokens (D4) — reports the 1-based line of each finding', () => {
        // Given - an unknown token on the third line
        const violations = findUnknownTokens('ok\nok {{sha}}\nbad {{sha256}}');

        // Then - line 3
        expect(violations).toStrictEqual([{ line: 3, token: '{{sha256}}' }]);
    });

    test('conventions checker — findUnknownTokens (D4) — ignores structural template noise like Go templates', () => {
        // Given - braces that are not identifier-shaped tokens
        const text = 'docker {{.Server.Version}} and {{ spaced }} and {{123}}';

        // Then - out of the grammar, not flagged
        expect(findUnknownTokens(text)).toStrictEqual([]);
    });

    test('conventions checker — findKnownTokens (D10) — reports known tokens (the requests/ leak signal)', () => {
        // Given - a request body carrying a token
        // Then - the known token is surfaced (an unknown one is not this signal)
        expect(findKnownTokens('{"id": "{{uuid}}", "x": "{{userid}}"}')).toStrictEqual([
            { line: 1, token: '{{uuid}}' },
        ]);
    });

    test('conventions checker — checkConventionFiles (D4) — walks a specs tree and reports unknown tokens in fixture files', () => {
        // Given - the violation fixture tree ({{userid}} in expected/out.txt)
        const violations = checkConventionFiles(resolve(FIXTURES, 'd4-unknown-token'));

        // Then - the finding names the relative file, line, token and severity
        expect(violations).toStrictEqual([
            expect.objectContaining({
                file: 'specs/widget/expected/out.txt',
                line: 1,
                severity: 'error',
                token: '{{userid}}',
            }),
        ]);

        // Then - the rendering carries file, token and the known vocabulary
        const rendered = formatViolations(violations);
        expect(rendered).toContain('specs/widget/expected/out.txt:1');
        expect(rendered).toContain('{{userid}}');
        expect(rendered).toContain('uuid');
    });

    test('conventions checker — checkConventionFiles (D4) — passes the compliant twin', () => {
        // Given - the -ok tree (only known tokens)
        const violations = checkConventionFiles(resolve(FIXTURES, 'd4-unknown-token-ok'));

        // Then - clean
        expect(violations).toStrictEqual([]);
    });

    test('the tree the checker judges — what git does not ignore — judges an untracked document, and never an ignored one', () => {
        // Given - three documents repeating their directory: tracked, new, and ignored
        const root = repository(
            ['specs/rm/rm.spec.yaml', 'specs/cp/cp.spec.yaml', 'specs/mv/mv.spec.yaml'],
            ['specs/rm/rm.spec.yaml'],
            'specs/mv/\n',
        );

        // Then - the tracked and the new one are reported, the ignored one is not
        expect(findings(root, 'c12').map((line) => line.split(':')[0])).toStrictEqual([
            'cp/cp.spec.yaml',
            'rm/rm.spec.yaml',
        ]);
    });

    test('the tree the checker judges — what git does not ignore — reads a `file()` whose target is new as existing, and an ignored one as not (C8)', () => {
        // Given - a spec naming three goldens on disk: tracked, new, and ignored
        const root = repository(
            [
                'specs/api/expected/added.txt',
                'specs/api/expected/new.txt',
                'specs/api/expected/local.txt',
            ],
            ['specs/api/expected/added.txt'],
            'local.txt\n',
        );
        writeFileSync(
            join(root, 'specs', 'api', 'boot.spec.ts'),
            [
                "expect(a).toMatch(file('./expected/added.txt'));",
                "expect(b).toMatch(file('./expected/new.txt'));",
                "expect(c).toMatch(file('./expected/local.txt'));",
                '',
            ].join('\n'),
        );

        // Then - only the ignored golden names nothing a checkout holds
        expect(findings(root, 'c8-disk-target-exists')).toStrictEqual([
            "api/boot.spec.ts:3: file('./expected/local.txt') names nothing — api/expected/local.txt is ignored by git",
        ]);
    });

    test('the moves the fixers make — keeps the history of a fixture C14 moves in a git checkout', () => {
        // Given - a tracked single-reader pool fixture
        const root = singleReaderPool(true);

        // When - the fixer moves it beside its leaf
        fixPoolFixtures(join(root, 'specs'));

        // Then - the index holds the new path and not the old one
        const indexed = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
        expect(indexed.split('\n').filter(Boolean).toSorted()).toStrictEqual([
            'specs/api/boot.spec.ts',
            'specs/api/fixtures/app/index.txt',
        ]);
    });

    test('the moves the fixers make — moves a C14 fixture by plain rename where git places the tree in no work tree', () => {
        // Given - the same tree, and no repository
        const root = singleReaderPool(false);

        // When - the fixer moves it beside its leaf
        fixPoolFixtures(join(root, 'specs'));

        // Then - the disk holds it at its new place only
        expect(existsSync(join(root, 'specs', 'api', 'fixtures', 'app', 'index.txt'))).toBe(true);
        expect(existsSync(join(root, 'specs', 'shared'))).toBe(false);
    });

    test('the single paths the checker probes — through the same tree — an ignored pool directory is no fixture to move (C14)', () => {
        // Given - a pool directory `.gitignore` names, reached from one leaf
        const root = repository(
            ['specs/shared/fixtures/app/index.txt', 'specs/shared/fixtures/kept.txt'],
            [],
            'specs/shared/fixtures/app/\n',
        );
        mkdirSync(join(root, 'specs', 'api'));
        writeFileSync(
            join(root, 'specs', 'api', 'boot.spec.ts'),
            "await api.fixture(directory('../shared/fixtures/app/')).get('/');\n",
        );

        // Then - C8 names the path, and C14 has nothing to move
        expect(findings(root, 'c14')).toStrictEqual([]);
        expect(findings(root, 'c8-disk-target-exists')).toHaveLength(1);
    });

    test('the single paths the checker probes — through the same tree — a manifest `.gitignore` names is no package (the member pass)', () => {
        // Given - one new manifest and one ignored one
        const root = repository(['fresh/package.json', 'local/package.json'], [], 'local/\n');
        writeFileSync(join(root, 'fresh', 'package.json'), '{}\n');
        writeFileSync(join(root, 'local', 'package.json'), '{}\n');

        // Then - only the new one declares a package
        expect(readManifest(join(root, 'fresh'))).not.toBeNull();
        expect(readManifest(join(root, 'local'))).toBeNull();
    });

    test('the single paths the checker probes — through the same tree — a nested manifest `.gitignore` names bounds no walk (the member pass)', () => {
        // Given - a spec outside `specs/` under a folder whose own manifest is ignored
        const root = repository(
            ['tools/package.json', 'tools/boot.spec.ts'],
            [],
            'tools/package.json\n',
        );
        writeFileSync(join(root, 'tools', 'package.json'), '{}\n');

        // Then - the folder is the member's, and its spec is reported
        expect(checkSpecOutsideSpecs(root).map(({ file }) => file)).toStrictEqual([
            join('tools', 'boot.spec.ts'),
        ]);
    });

    test('the single paths the checker probes — through the same tree — a golden `.gitignore` names is not one the mover points at (C13)', () => {
        // Given - a 16 leaf whose `_expected/` holds a new golden and an ignored one
        const root = repository(
            [
                'specs/cli/help/_expected/usage.txt',
                'specs/cli/help/_expected/local.txt',
                'specs/cli/help/help.test.ts',
            ],
            [],
            'local.txt\n',
        );
        writeFileSync(
            join(root, 'specs', 'cli', 'help', 'help.test.ts'),
            "expect(a).toMatch('usage.txt');\nexpect(b).toMatch('local.txt');\n",
        );

        // When - the mover runs
        migrateTo17(join(root, 'specs'), moveKeepingHistory);

        // Then - the new golden is named by its path, the ignored name stays a value
        expect(readFileSync(join(root, 'specs', 'cli', 'help', 'help.test.ts'), 'utf8')).toContain(
            "expect(a).toMatch(file('./expected/usage.txt'));\nexpect(b).toMatch('local.txt');",
        );
    });

    test('the single paths the checker probes — through the same tree — an ignored fixture fixes no value for the document beside it (D5)', () => {
        // Given - two documents asserting a temp path their `fixture:` holds, one of the two fixtures ignored
        const document = [
            'description: prints where it wrote',
            'fixture: ./fixtures/where.txt',
            'runs:',
            '    - command: widget where',
            '      exit: 0',
            '      stdout: |',
            '          /tmp/widget/out',
            '',
        ].join('\n');
        const root = repository(
            [
                'specs/kept/fixtures/where.txt',
                'specs/local/fixtures/where.txt',
                'specs/kept/prints-where.spec.yaml',
                'specs/local/prints-where.spec.yaml',
            ],
            [],
            'specs/local/fixtures/where.txt\n',
        );
        for (const leaf of ['kept', 'local']) {
            writeFileSync(join(root, 'specs', leaf, 'fixtures', 'where.txt'), '/tmp/widget/out\n');
            writeFileSync(join(root, 'specs', leaf, 'prints-where.spec.yaml'), document);
        }

        // Then - the value the ignored fixture held is volatile again
        expect(findings(root, 'd5').map((line) => line.split(':')[0])).toStrictEqual([
            'local/prints-where.spec.yaml',
        ]);
    });
});
