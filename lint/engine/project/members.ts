import { spawnSync } from 'node:child_process';
import { basename, join, relative, sep } from 'node:path';

import { treeEntries } from './git-tree.js';
import { MEMBER_DEPTH, readManifest, workspacePatterns } from './member-manifest.js';
import { SKIPPED } from './module-tests.js';

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
