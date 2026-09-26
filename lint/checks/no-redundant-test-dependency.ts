import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { treeEntries, treeKind } from '../../src/kernel/files/git-tree.js';
import type { Finding } from './checker.js';
import { MEMBER_DEPTH, readManifest, SKIPPED, workspacePatterns } from './member-manifest.js';
import type { Manifest } from './member-manifest.js';

/** Optional peers are not here: `playwright`, `vite`, `react`, `better-sqlite3` and their kin are declared by the consumer on purpose. */
const CARRIED = new Set(['msw', 'vitest-mock-extended']);

/** Only as a dev dependency: a member parsing YAML at runtime declares `yaml` rightly, and the framework never ships it to a product. */
const CARRIED_IN_DEV = new Set(['yaml']);

/** `no-redundant-test-dependency` never reads the manifest of the package that carries the dependencies. */
const FRAMEWORK = '@jterrazz/test';

const RETIRED = new Set(['@playwright/test', 'happy-dom', 'jsdom', 'mockdate']);

const RETIRED_SCOPES = ['@testing-library/'];

/** React Native renders under jest until the react-native-web answer lands, and `@testing-library/react-native` is the only vocabulary there; the allowance lapses the day jest stops running the member's tests. */
const JEST_ONLY_SEAM = '@testing-library/react-native';

function declaresJest(manifest: Manifest): boolean {
    const declares = (name: string): boolean =>
        name in (manifest.dependencies ?? {}) || name in (manifest.devDependencies ?? {});
    return (
        declares('jest') ||
        declares('jest-expo') ||
        manifest.jest !== undefined ||
        /(?:^|[\s/])jest(?:\s|$)/u.test(manifest.scripts?.test ?? '')
    );
}

const JEST_CONFIG = /^jest\.config\.[cm]?[jt]s$/u;

const JEST_REACH =
    /\b(?:roots|testMatch|testPathDirs|testPathIgnorePatterns)\s*:\s*\[(?<paths>[^\]]*)\]/gu;

const JEST_PATH = /['"`](?<path>[^'"`\n]*)['"`]/gu;

const PNPM_WORKSPACE = ['pnpm-workspace.yaml', 'pnpm-workspace.yml'];

function declaresWorkspace(dir: string): boolean {
    if (PNPM_WORKSPACE.some((name) => treeKind(join(dir, name)) === 'file')) {
        return true;
    }
    const manifest = readManifest(dir);
    return manifest !== null && workspacePatterns(manifest).length > 0;
}

/** Walked up from the member, so a run started inside it reads the jest the root run reads; it stops at the first workspace declaration and never leaves the checkout (a `.git` directory or worktree file). */
function workspaceRootOf(memberDir: string): string {
    let current = memberDir;
    for (;;) {
        if (declaresWorkspace(current) || existsSync(join(current, '.git'))) {
            return current;
        }
        const parent = dirname(current);
        if (parent === current) {
            return memberDir;
        }
        current = parent;
    }
}

const jestConfigs = new Map<string, string[]>();

function findJestConfigs(rootDir: string): string[] {
    const cached = jestConfigs.get(rootDir);
    if (cached !== undefined) {
        return cached;
    }
    const found: string[] = [];
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
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.') && !SKIPPED.has(entry.name)) {
                    walk(path, depth + 1);
                }
            } else if (JEST_CONFIG.test(entry.name)) {
                found.push(path);
            }
        }
    };
    walk(rootDir, 0);
    jestConfigs.set(rootDir, found);
    return found;
}

/** `<rootDir>` is jest's token for its config's directory: a path resolves against it, and the member is reached when the result lands inside it. */
function jestReachesMember(memberDir: string, rootDir: string): boolean {
    return findJestConfigs(rootDir).some((config) => {
        const from = dirname(config);
        let text;
        try {
            text = readFileSync(config, 'utf8');
        } catch {
            return false;
        }
        return [...text.matchAll(JEST_REACH)].some((list) =>
            [...(list.groups?.paths ?? '').matchAll(JEST_PATH)].some((entry) => {
                const stated = (entry.groups?.path ?? '').replace('<rootDir>', from);
                const absolute = resolve(from, stated);
                return absolute === memberDir || absolute.startsWith(`${memberDir}/`);
            }),
        );
    });
}

type Seam = { kind: 'carried' | 'retired'; name: string };

function declaredSeams(manifest: Manifest, jestRuns: boolean): Seam[] {
    if (manifest.name === FRAMEWORK) {
        return [];
    }
    const isRetired = (name: string): boolean => {
        if (name === JEST_ONLY_SEAM && jestRuns) {
            return false;
        }
        return RETIRED.has(name) || RETIRED_SCOPES.some((scope) => name.startsWith(scope));
    };
    const declared = new Set([
        ...Object.keys(manifest.dependencies ?? {}).filter(
            (name) => CARRIED.has(name) || isRetired(name),
        ),
        ...Object.keys(manifest.devDependencies ?? {}).filter(
            (name) => CARRIED.has(name) || CARRIED_IN_DEV.has(name) || isRetired(name),
        ),
    ]);
    return [...declared].toSorted().map((name) => ({
        kind: isRetired(name) ? ('retired' as const) : ('carried' as const),
        name,
    }));
}

/** A finding points at the declaration, not at `{`. */
function lineOfKey(dir: string, key: string): number {
    try {
        const lines = readFileSync(join(dir, 'package.json'), 'utf8').split('\n');
        const found = lines.findIndex((line) => line.includes(`"${key}"`));
        return found === -1 ? 1 : found + 1;
    } catch {
        return 1;
    }
}

export function seamDependencies(member: {
    label: string;
    manifest: Manifest;
    memberDir: string;
    subject: string;
}): Finding[] {
    const { label, manifest, memberDir, subject } = member;
    const jestRuns =
        declaresJest(manifest) || jestReachesMember(memberDir, workspaceRootOf(memberDir));
    return declaredSeams(manifest, jestRuns).map((seam) => ({
        file: join(label, 'package.json'),
        line: lineOfKey(memberDir, seam.name),
        fix:
            seam.kind === 'carried'
                ? `remove \`${seam.name}\` from ${join(label, 'package.json')}`
                : `remove \`${seam.name}\` from ${join(label, 'package.json')}, and write its tests on \`component()\`, \`website()\`, \`clock\` or \`intercept()\``,
        found:
            seam.kind === 'carried'
                ? `${subject}: \`${seam.name}\` is a transitive of \`@jterrazz/test\``
                : `${subject}: \`${seam.name}\` is a seam \`@jterrazz/test\` replaced`,
        rule: 'no-redundant-test-dependency' as const,
        severity: 'error' as const,
    }));
}
