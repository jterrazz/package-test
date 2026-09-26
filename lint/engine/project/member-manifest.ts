import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { treeKind } from './git-tree.js';

/** The toolchain's bound, to the segment. */
export const MEMBER_DEPTH = 6;

export type Manifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    jest?: unknown;
    name?: string;
    scripts?: Record<string, string>;
    workspaces?: string[] | { packages?: string[] };
};

export function readManifest(dir: string): Manifest | null {
    const path = join(dir, 'package.json');
    if (treeKind(path) !== 'file') {
        return null;
    }
    try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`; the shape named here is the one every read below goes through, and a wrong one reads as absent
        return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
    } catch {
        return null;
    }
}

export function workspacePatterns(manifest: Manifest): string[] {
    const { workspaces } = manifest;
    if (Array.isArray(workspaces)) {
        return workspaces;
    }
    return workspaces?.packages ?? [];
}
