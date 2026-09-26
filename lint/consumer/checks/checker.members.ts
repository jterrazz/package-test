import { basename, join, relative } from 'node:path';

import { treeKind } from '../../../src/kernel/files/git-tree.js';
import { readManifest } from '../../engine/project/member-manifest.js';
import { discoverMembers } from '../../engine/project/members.js';
import { moduleTestsOf } from '../../engine/project/module-tests.js';
import type { Finding } from './checker.js';
import { checkFileSuffixMatchesPlaceInMember } from './file-suffix-matches-place.js';
import { checkMemberHasVitestConfig } from './member-has-vitest-config.js';
import { checkNamedPathExistsIn } from './named-path-exists.js';
import { checkNoRedundantTestDependency } from './no-redundant-test-dependency.js';
import { checkNoSimulatedDomInConfig } from './no-simulated-dom-in-config.js';
import { checkNoSnapshotFolder } from './no-snapshot-folder.js';

const CONFIG_NAMES = [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.cts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vitest.config.cjs',
];

function configOf(dir: string): null | string {
    for (const name of CONFIG_NAMES) {
        const path = join(dir, name);
        if (treeKind(path) === 'file') {
            return path;
        }
    }
    return null;
}

function anchoredToRoot(violations: Finding[], label: string): Finding[] {
    if (label === '.') {
        return violations;
    }
    const anchored: Finding[] = [];
    for (const violation of violations) {
        anchored.push({ ...violation, file: join(label, violation.file) });
    }
    return anchored;
}

/** What a workspace member owes, read from the member itself: a member with no `specs/` root is still judged. */
export function checkMember(memberDir: string, rootDir: string): Finding[] {
    const manifest = readManifest(memberDir);
    if (manifest === null) {
        return [];
    }
    const label = relative(rootDir, memberDir) || '.';
    // `--member .` is the ordinary run, and `.: no vitest.config.ts` names nothing a reader can act on.
    const subject = label === '.' ? (manifest.name ?? basename(memberDir)) : label;
    const config = configOf(memberDir);

    return [
        ...(config === null ? checkMemberHasVitestConfig(manifest, memberDir, label, subject) : []),
        ...(config === null ? [] : checkNoSimulatedDomInConfig(config, rootDir)),
        ...checkNoRedundantTestDependency({ label, manifest, memberDir, subject }),
        // Only a walk of the member sees a `.spec.ts` that never reached a `specs/` tree.
        ...anchoredToRoot(checkFileSuffixMatchesPlaceInMember(memberDir), label),
        ...checkNoSnapshotFolder(memberDir, label),
        // The tree pass reads the tests under `specs/`.
        ...moduleTestsOf(memberDir).flatMap((test) => checkNamedPathExistsIn(test, rootDir)),
    ];
}

export function checkMembers(rootDir: string): Finding[] {
    return discoverMembers(rootDir).flatMap((member) => checkMember(member, rootDir));
}
