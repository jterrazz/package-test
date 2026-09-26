import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runMember, runMembers } from '../../engine/checker/member-run.js';
import { runTree } from '../../engine/checker/tree-run.js';
import { readManifest } from '../../engine/project/member-manifest.js';
import { checkoutUnder } from '../../engine/testing/package-tree.fixtures.js';
import { CHECKER } from './checker.js';
import { checkFileSuffixMatchesPlaceInMember } from './file-suffix-matches-place.js';

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
    return runTree(join(root, 'specs'), CHECKER)
        .filter((violation) => violation.rule === rule)
        .map((violation) => `${violation.file}:${violation.line}: ${violation.found}`)
        .toSorted();
}
const WORKSPACE = resolve(import.meta.dirname, '../../../specs/_shared/_fixtures/member-workspace');
const memberAt = (name: string): string => resolve(WORKSPACE, 'packages', name);

function codes(dir: string, root = WORKSPACE): string[] {
    return runMember(dir, root, CHECKER).map((violation) => violation.rule);
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
                'specs/api/_expected/added.txt',
                'specs/api/_expected/new.txt',
                'specs/api/_expected/local.txt',
            ],
            ['specs/api/_expected/added.txt'],
            'local.txt\n',
        );
        writeFileSync(
            join(root, 'specs', 'api', 'boot.spec.ts'),
            [
                "expect(a).toMatch(file('./_expected/added.txt'));",
                "expect(b).toMatch(file('./_expected/new.txt'));",
                "expect(c).toMatch(file('./_expected/local.txt'));",
                '',
            ].join('\n'),
        );

        // Then - only the ignored golden names nothing a checkout holds
        expect(findings(root, 'named-path-exists')).toStrictEqual([
            "api/boot.spec.ts:3: file('./_expected/local.txt') names nothing — api/_expected/local.txt is ignored by git",
        ]);
    });

    test('the single paths the checker probes — through the same tree — an ignored pool directory is no fixture to move (`ground-shared-or-inline`)', () => {
        // Given - a pool directory `.gitignore` names, reached from one leaf
        const root = repository(
            ['specs/_shared/_fixtures/app/index.txt', 'specs/_shared/_fixtures/kept.txt'],
            [],
            'specs/_shared/_fixtures/app/\n',
        );
        mkdirSync(join(root, 'specs', 'api'));
        writeFileSync(
            join(root, 'specs', 'api', 'boot.spec.ts'),
            "await api.fixture(directory('../_shared/_fixtures/app/')).get('/');\n",
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
        expect(checkFileSuffixMatchesPlaceInMember(root).map(({ file }) => file)).toStrictEqual([
            join('tools', 'boot.spec.ts'),
        ]);
    });

    test('the single paths the checker probes — through the same tree — an ignored fixture fixes no value for the document beside it (`no-volatile-literal`)', () => {
        // Given - two documents asserting a temp path their `fixture:` holds, one of the two fixtures ignored
        const document = [
            'description: prints where it wrote',
            'fixture: ./_fixtures/where.txt',
            'runs:',
            '    - command: widget where',
            '      exit: 0',
            '      stdout: |',
            '          /tmp/widget/out',
            '',
        ].join('\n');
        const root = repository(
            [
                'specs/kept/_fixtures/where.txt',
                'specs/local/_fixtures/where.txt',
                'specs/kept/prints-where.spec.yaml',
                'specs/local/prints-where.spec.yaml',
            ],
            [],
            'specs/local/_fixtures/where.txt\n',
        );
        for (const leaf of ['kept', 'local']) {
            writeFileSync(join(root, 'specs', leaf, '_fixtures', 'where.txt'), '/tmp/widget/out\n');
            writeFileSync(join(root, 'specs', leaf, 'prints-where.spec.yaml'), document);
        }

        // Then - the value the ignored fixture held is volatile again
        expect(
            findings(root, 'no-volatile-literal').map((line) => line.split(':')[0]),
        ).toStrictEqual(['local/prints-where.spec.yaml']);
    });

    test('members — members — the member pass — what a workspace member owes — a member that owes nothing produces nothing', () => {
        // Given - a member with a config, a test script and only optional peers
        // Then - the pass is silent
        expect(codes(memberAt('clean'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — a member whose own root is the specs tree holds specs, not strays (`file-suffix-matches-place`)', () => {
        // Given - `@fixture/specs-rooted`, a member declared as `specs` (spwn's shape), holding `cli/agent/agent-list.spec.ts`
        // Then - the member pass reads the tree it IS: nothing is outside a specs tree here
        expect(codes(resolve(WORKSPACE, 'specs'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — a folder of code named like ground is read below the member, never above it (`no-snapshot-folder`)', () => {
        // Given - a package checked out under a folder named `specs/`, whose `src/goldens/` is matcher source
        const member = checkoutUnder('specs', ['src/goldens']);
        writeFileSync(join(member, 'src/goldens/matchers.ts'), 'export const golden = 1;\n');

        // Then - the `specs` above the checkout is the machine's: the folder holds code, and stays
        expect(codes(member, member)).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — every member is judged in one run', () => {
        // Given - the whole fixture workspace
        const found = runMembers(WORKSPACE, CHECKER).map((violation) => violation.rule);

        // Then - one `member-has-vitest-config`, one `no-simulated-dom-in-config`, three `no-redundant-test-dependency` and one `file-suffix-matches-place`, whatever the order they walk in
        expect(found.toSorted()).toStrictEqual([
            'file-suffix-matches-place',
            'member-has-vitest-config',
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
            'no-simulated-dom-in-config',
        ]);
    });
});
