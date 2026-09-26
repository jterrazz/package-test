import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runAllChecks } from './checker.js';
import { checkSpecOutsideSpecs } from './file-suffix-matches-place.js';
import { readManifest } from './member-manifest.js';

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
    const root = mkdtempSync(join(tmpdir(), 'tree-'));
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
        .filter((violation) => violation.rule === rule)
        .map((violation) => `${violation.file}:${violation.line}: ${violation.found}`)
        .toSorted();
}
describe('checker', () => {
    test('the tree the checker judges — what git does not ignore — judges an untracked document, and never an ignored one', () => {
        // Given - three documents repeating their directory: tracked, new, and ignored
        const root = repository(
            ['specs/rm/rm.spec.yaml', 'specs/cp/cp.spec.yaml', 'specs/mv/mv.spec.yaml'],
            ['specs/rm/rm.spec.yaml'],
            'specs/mv/\n',
        );

        // Then - the tracked and the new one are reported, the ignored one is not
        expect(
            findings(root, 'file-suffix-matches-place').map((line) => line.split(':')[0]),
        ).toStrictEqual(['cp/cp.spec.yaml', 'rm/rm.spec.yaml']);
    });

    test('the tree the checker judges — what git does not ignore — reads a `file()` whose target is new as existing, and an ignored one as not (`named-path-exists`)', () => {
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
        expect(findings(root, 'named-path-exists')).toStrictEqual([
            "api/boot.spec.ts:3: file('./expected/local.txt') names nothing — api/expected/local.txt is ignored by git",
        ]);
    });

    test('the single paths the checker probes — through the same tree — an ignored pool directory is no fixture to move (`ground-shared-or-inline`)', () => {
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

        // Then - `named-path-exists` names the path, and `ground-shared-or-inline` has nothing to move
        expect(findings(root, 'ground-shared-or-inline')).toStrictEqual([]);
        expect(findings(root, 'named-path-exists')).toHaveLength(1);
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

    test('the single paths the checker probes — through the same tree — an ignored fixture fixes no value for the document beside it (`no-volatile-literal`)', () => {
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
        expect(
            findings(root, 'no-volatile-literal').map((line) => line.split(':')[0]),
        ).toStrictEqual(['local/prints-where.spec.yaml']);
    });
});
