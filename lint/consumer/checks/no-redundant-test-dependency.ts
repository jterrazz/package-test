import {
    MEMBER_DEPTH,
    readManifest,
    treeEntries,
    treeKind,
    workspacePatterns,
} from '@jterrazz/typescript/rules';
import type { Manifest } from '@jterrazz/typescript/rules';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { PRUNED_WITH_OUTPUTS } from '../../kit/project/module-tests.js';
import type { Spotted } from './checker.js';

/** Optional peers are not here: `playwright`, `vite`, `react`, `better-sqlite3` and their kin are declared by the consumer on purpose. */
export const CARRIED = new Set(['msw', 'vitest-mock-extended']);

/** Only as a dev dependency: a member parsing YAML at runtime declares `yaml` rightly, and the framework never ships it to a product. */
export const CARRIED_IN_DEV = new Set(['yaml']);

// invariant: `no-redundant-test-dependency` never reads the manifest of the package that carries the dependencies.
const FRAMEWORK = '@jterrazz/test';

const REPLACED_SEAMS = new Set(['@playwright/test', 'happy-dom', 'jsdom', 'mockdate']);

const REPLACED_SCOPE = '@testing-library/';

// outside: React Native renders under jest until the react-native-web answer lands, and `@testing-library/react-native` is the only vocabulary there; the allowance lapses the day jest stops running the member's tests.
const JEST_ONLY_SEAM = '@testing-library/react-native';

function declaresJest(manifest: Manifest): boolean {
    const declares = (name: string): boolean =>
        name in (manifest.dependencies ?? {}) || name in (manifest.devDependencies ?? {});
    return (
        declares('jest') ||
        declares('jest-expo') ||
        manifest.jest !== undefined ||
        // Stryker disable next-line StringLiteral: no script at all names no jest, whatever text stands for it
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

// outside: walked up from the member, so a run started inside it reads the jest the root run reads; it stops at the first workspace declaration and never leaves the checkout (a `.git` directory or worktree file).
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

type JestConfig = { from: string; text: string };

function jestConfigsUnder(dir: string, depth = 0): JestConfig[] {
    if (depth > MEMBER_DEPTH) {
        return [];
    }
    let entries;
    try {
        entries = treeEntries(dir);
    } catch {
        return [];
    }
    return entries.flatMap((entry): JestConfig[] => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            return entry.name.startsWith('.') || PRUNED_WITH_OUTPUTS.has(entry.name)
                ? []
                : jestConfigsUnder(path, depth + 1);
        }
        if (!JEST_CONFIG.test(entry.name)) {
            return [];
        }
        try {
            return [{ from: dir, text: readFileSync(path, 'utf8') }];
        } catch {
            return [];
        }
    });
}

// outside: `<rootDir>` is jest's token for its config's directory: a path resolves against it, and the member is reached when the result lands inside it.
function jestReachesMember(memberDir: string, rootDir: string): boolean {
    return jestConfigsUnder(rootDir).some(({ from, text }) =>
        [...text.matchAll(JEST_REACH)].some((list) =>
            // Stryker disable next-line OptionalChaining,StringLiteral: a match always carries its named group
            [...(list.groups?.paths ?? '').matchAll(JEST_PATH)].some((entry) => {
                // Stryker disable next-line OptionalChaining,StringLiteral: a match always carries its named group
                const stated = entry.groups?.path ?? '';
                const absolute = resolve(from, stated.replace('<rootDir>', from));
                return absolute === memberDir || absolute.startsWith(`${memberDir}/`);
            }),
        ),
    );
}

type Seam = { kind: 'carried' | 'replaced'; name: string };

function declaredSeams(manifest: Manifest, jestRuns: boolean): Seam[] {
    if (manifest.name === FRAMEWORK) {
        return [];
    }
    const isReplaced = (name: string): boolean => {
        if (name === JEST_ONLY_SEAM && jestRuns) {
            return false;
        }
        return REPLACED_SEAMS.has(name) || name.startsWith(REPLACED_SCOPE);
    };
    const declared = new Set([
        ...Object.keys(manifest.dependencies ?? {}).filter(
            (name) => CARRIED.has(name) || isReplaced(name),
        ),
        ...Object.keys(manifest.devDependencies ?? {}).filter(
            (name) => CARRIED.has(name) || CARRIED_IN_DEV.has(name) || isReplaced(name),
        ),
    ]);
    return [...declared].toSorted().map((name) => ({
        kind: isReplaced(name) ? ('replaced' as const) : ('carried' as const),
        name,
    }));
}

// invariant: a finding points at the declaration, not at `{`.
function lineOfKey(dir: string, key: string): number {
    try {
        const lines = readFileSync(join(dir, 'package.json'), 'utf8').split('\n');
        const found = lines.findIndex((line) => line.includes(`"${key}"`));
        // Stryker disable next-line ConditionalExpression,UnaryOperator: the manifest read is this file, so its key is always found
        return found === -1 ? 1 : found + 1;
    } catch {
        return 1;
    }
}

export function checkNoRedundantTestDependency(member: {
    label: string;
    manifest: Manifest;
    memberDir: string;
    subject: string;
}): Spotted[] {
    const { label, manifest, memberDir, subject } = member;
    const jestRuns =
        declaresJest(manifest) || jestReachesMember(memberDir, workspaceRootOf(memberDir));
    return declaredSeams(manifest, jestRuns).map((seam) => ({
        path: join(label, 'package.json'),
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
    }));
}
