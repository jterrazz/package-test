import { readManifest, treeEntries, workspaceMembers } from '@jterrazz/typescript/rules';
import { basename, join } from 'node:path';

import { PRUNED_WITH_OUTPUTS } from './module-tests.js';

/** The root itself included: a single-package repository is its own member. */
export function discoverMembers(rootDir: string): string[] {
    if (readManifest(rootDir) === null) {
        return [];
    }
    return [rootDir, ...workspaceMembers(rootDir).map((member) => join(rootDir, member))];
}

const SPECS_DEPTH = 6;

/** Stated rather than guessed, so a path-less run reports exactly what a per-root run would; a member directory named `specs` is a root of its own. */
export function discoverSpecRoots(rootDir: string): string[] {
    const roots = new Set<string>();
    // invariant: a tree named by hand is judged on what it holds.
    const members = discoverMembers(rootDir);
    for (const member of members.length === 0 ? [rootDir] : members) {
        // invariant: a workspace declaring `packages: ['specs']`: without this the ratchet run walked no tree for that member.
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
                if (
                    !entry.isDirectory() ||
                    entry.name.startsWith('.') ||
                    PRUNED_WITH_OUTPUTS.has(entry.name)
                ) {
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
    // invariant: the walk reads the tree git keeps, so an ignored folder is never reached.
    return [...roots].toSorted();
}
