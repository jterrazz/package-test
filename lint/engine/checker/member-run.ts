import { basename, join, relative } from 'node:path';

import { treeKind } from '../project/git-tree.js';
import { readManifest } from '../project/member-manifest.js';
import { discoverMembers } from '../project/members.js';
import type { Finding } from './finding.js';
import type { CheckerRegistry } from './registry.js';

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

function anchoredTo(label: string): (findings: Finding[]) => Finding[] {
    return (findings) =>
        label === '.'
            ? findings
            : findings.map((finding) => ({ ...finding, file: join(label, finding.file) }));
}

/** What a workspace member owes, read from the member itself: a member with no `specs/` root is still judged. */
export function runMember(
    memberDir: string,
    rootDir: string,
    registry: CheckerRegistry,
): Finding[] {
    const manifest = readManifest(memberDir);
    if (manifest === null) {
        return [];
    }
    const label = relative(rootDir, memberDir) || '.';
    // `--member .` is the ordinary run, and `.: no vitest.config.ts` names nothing a reader can act on.
    const subject = label === '.' ? (manifest.name ?? basename(memberDir)) : label;
    return registry.member({
        anchored: anchoredTo(label),
        config: configOf(memberDir),
        label,
        manifest,
        memberDir,
        rootDir,
        subject,
    });
}

export function runMembers(rootDir: string, registry: CheckerRegistry): Finding[] {
    return discoverMembers(rootDir).flatMap((member) => runMember(member, rootDir, registry));
}
