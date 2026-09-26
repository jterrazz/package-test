import { spawnSync } from 'node:child_process';
import { basename, join, relative, sep } from 'node:path';

import { treeEntries, treeKind } from '../../src/kernel/files/git-tree.js';
import { moduleTestsOf } from '../reading/module-tests.js';
import type { TokenViolation } from './checker.js';
import { checkSpecOutsideSpecs } from './file-suffix-matches-place.js';
import { configPresent } from './member-has-vitest-config.js';
import { MEMBER_DEPTH, readManifest, SKIPPED, workspacePatterns } from './member-manifest.js';
import { diskTargetFindings } from './named-path-exists.js';
import { seamDependencies } from './no-redundant-test-dependency.js';
import { simulatedDom } from './no-simulated-dom-in-config.js';
import { groundSynonyms } from './no-snapshot-folder.js';

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

function anchoredToRoot(violations: TokenViolation[], label: string): TokenViolation[] {
    if (label === '.') {
        return violations;
    }
    const anchored: TokenViolation[] = [];
    for (const violation of violations) {
        anchored.push({ ...violation, file: join(label, violation.file) });
    }
    return anchored;
}

/** What a workspace member owes, read from the member itself: a member with no `specs/` root is still judged. */
export function checkMember(memberDir: string, rootDir: string): TokenViolation[] {
    const manifest = readManifest(memberDir);
    if (manifest === null) {
        return [];
    }
    const label = relative(rootDir, memberDir) || '.';
    // `--member .` is the ordinary run, and `.: no vitest.config.ts` names nothing a reader can act on.
    const subject = label === '.' ? (manifest.name ?? basename(memberDir)) : label;
    const config = configOf(memberDir);

    return [
        ...(config === null ? configPresent(manifest, memberDir, label, subject) : []),
        ...(config === null ? [] : simulatedDom(config, rootDir)),
        ...seamDependencies({ label, manifest, memberDir, subject }),
        // Only a walk of the member sees a `.spec.ts` that never reached a `specs/` tree.
        ...anchoredToRoot(checkSpecOutsideSpecs(memberDir), label),
        ...groundSynonyms(memberDir, label),
        // The tree pass reads the tests under `specs/`.
        ...moduleTestsOf(memberDir).flatMap((test) => diskTargetFindings(test, rootDir)),
    ];
}

/** The translation `@jterrazz/typescript`'s `lib/workspace-members.js` makes: the two member lists must be one list, or the ratchet can neither record nor clear a finding. */
function toPattern(glob: string): RegExp {
    const escaped = glob
        .replaceAll(/[.+^${}()|[\]\\]/gu, String.raw`\$&`)
        .replaceAll('**', ' ')
        .replaceAll('*', '[^/]*')
        .replaceAll(' ', '.*');
    return new RegExp(`^${escaped}$`, 'u');
}

/** The root itself included: a single-package repository is its own member. */
export function discoverMembers(rootDir: string): string[] {
    const manifest = readManifest(rootDir);
    if (manifest === null) {
        return [];
    }
    const patterns = workspacePatterns(manifest)
        .filter((glob) => typeof glob === 'string' && !glob.startsWith('!'))
        .map((glob) => toPattern(glob.replace(/\/+$/u, '')));
    const members = new Set<string>([rootDir]);
    if (patterns.length === 0) {
        return [...members];
    }

    const walk = (dir: string, depth: number): void => {
        if (depth > MEMBER_DEPTH) {
            return;
        }
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.') || SKIPPED.has(entry.name)) {
                continue;
            }
            const child = join(dir, entry.name);
            const path = relative(rootDir, child).split(sep).join('/');
            // A member is never walked into: what it contains is its own workspace.
            if (patterns.some((pattern) => pattern.test(path)) && readManifest(child) !== null) {
                members.add(child);
                continue;
            }
            walk(child, depth + 1);
        }
    };
    walk(rootDir, 0);
    return [...members];
}

/** The toolchain skips them too, so the two lists agree. */
function ignoredPaths(rootDir: string, candidates: string[]): Set<string> {
    if (candidates.length === 0) {
        return new Set();
    }
    try {
        const answer = spawnSync('git', ['check-ignore', '--stdin'], {
            cwd: rootDir,
            encoding: 'utf8',
            input: `${candidates.join('\n')}\n`,
        });
        if (answer.error !== undefined || answer.stdout === '') {
            return new Set();
        }
        return new Set(answer.stdout.split('\n').filter(Boolean));
    } catch {
        return new Set();
    }
}

const SPECS_DEPTH = 6;

/** Stated rather than guessed, so a path-less run reports exactly what a per-root run would; a member directory named `specs` is a root of its own. */
export function discoverSpecRoots(rootDir: string): string[] {
    const roots = new Set<string>();
    // A tree named by hand is judged on what it holds.
    const members = discoverMembers(rootDir);
    for (const member of members.length === 0 ? [rootDir] : members) {
        // A workspace declaring `packages: ['specs']`: without this the ratchet run walked no tree for that member.
        if (basename(member) === 'specs') {
            roots.add(member);
        }
        const walk = (dir: string, depth: number): void => {
            if (depth > SPECS_DEPTH) {
                return;
            }
            let entries;
            try {
                entries = treeEntries(dir);
            } catch {
                return;
            }
            for (const entry of entries) {
                if (!entry.isDirectory() || entry.name.startsWith('.') || SKIPPED.has(entry.name)) {
                    continue;
                }
                const child = join(dir, entry.name);
                if (entry.name === 'specs') {
                    roots.add(child);
                    continue;
                }
                if (readManifest(child) !== null) {
                    continue;
                }
                walk(child, depth + 1);
            }
        };
        walk(member, 0);
    }
    const found = [...roots].toSorted();
    const ignored = ignoredPaths(
        rootDir,
        found.map((path) => relative(rootDir, path)),
    );
    return found.filter((path) => !ignored.has(relative(rootDir, path)));
}

export function checkMembers(rootDir: string): TokenViolation[] {
    return discoverMembers(rootDir).flatMap((member) => checkMember(member, rootDir));
}
