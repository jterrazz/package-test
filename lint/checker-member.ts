import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { treeEntries, treeKind, treeNames } from '../src/kernel/files/git-tree.js';
import { isGroundName } from '../src/kernel/files/ground.js';
import { diskTargetFindings } from './checker-crossfile.js';
import { checkSpecOutsideSpecs } from './checker-placement.js';
import type { TokenViolation } from './checker.js';
import { moduleTestsOf } from './module-tests.js';
import { isTestFileName } from './role.js';

/** The toolchain's bound, to the segment. */
const MEMBER_DEPTH = 6;

const SKIPPED = new Set(['.git', '.artifacts', 'coverage', 'dist', 'node_modules']);

/** The same pair the statique E5b refuses. */
const SIMULATED_DOM = /\benvironment\s*:\s*['"](?<dom>happy-dom|jsdom)['"]/u;

/** Optional peers are not here: `playwright`, `vite`, `react`, `better-sqlite3` and their kin are declared by the consumer on purpose. */
const CARRIED = new Set(['msw', 'vitest-mock-extended']);

/** Only as a dev dependency: a member parsing YAML at runtime declares `yaml` rightly, and the framework never ships it to a product. */
const CARRIED_IN_DEV = new Set(['yaml']);

/** F8 never reads the manifest of the package that carries the dependencies. */
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

const CONFIG_NAMES = [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.cts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vitest.config.cjs',
];

type Manifest = {
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

function configOf(dir: string): null | string {
    for (const name of CONFIG_NAMES) {
        const path = join(dir, name);
        if (treeKind(path) === 'file') {
            return path;
        }
    }
    return null;
}

/** A directory carrying its own `package.json` is another package's tree, and its tests are its own to configure. */
function holdsTests(dir: string): boolean {
    const stack = [dir];
    let first = true;
    while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined) {
            break;
        }
        if (!first && treeKind(join(current, 'package.json')) === 'file') {
            continue;
        }
        first = false;
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!SKIPPED.has(entry.name) && !entry.name.startsWith('.')) {
                    stack.push(join(current, entry.name));
                }
                continue;
            }
            if (isTestFileName(entry.name)) {
                return true;
            }
        }
    }
    return false;
}

/** `npm run test --workspaces`, `pnpm -r test` and `turbo run test` hand the work to the members: no evidence this package runs vitest. */
const DELEGATING_TEST =
    /--workspaces|(?:^|\s)-r(?:\s|$)|--recursive|turbo\s+run|nx\s+run-many|lerna\s+run/u;

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

function configPresent(
    manifest: Manifest,
    memberDir: string,
    label: string,
    subject: string,
): TokenViolation[] {
    // A delegating `test` script runs the members' tests, not this package's.
    const testScript = manifest.scripts?.test;
    const ownsTests =
        (typeof testScript === 'string' && !DELEGATING_TEST.test(testScript)) ||
        holdsTests(memberDir);
    if (!ownsTests) {
        return [];
    }
    return [
        {
            file: join(label, 'package.json'),
            line: 1,
            fix: `write ${join(label, 'vitest.config.ts')}: \`export default defineSpecConfig()\`, from \`@jterrazz/test/vitest\``,
            found: `${subject} has no vitest.config.ts — vitest's 5 s budget and an unexcluded \`fixtures/\` are running its tests`,
            rule: 'e3-config-present',
            severity: 'error',
        },
    ];
}

function simulatedDom(config: string, rootDir: string): TokenViolation[] {
    const text = readFileSync(config, 'utf8');
    const found = SIMULATED_DOM.exec(text);
    if (found?.groups?.dom === undefined) {
        return [];
    }
    const relConfig = relative(rootDir, config);
    return [
        {
            file: relConfig,
            line: text.slice(0, found.index).split('\n').length,
            fix: `delete \`environment: '${found.groups.dom}'\`, and write each rendered test as a \`.test.tsx\` beside its component, collected by \`component()\``,
            found: `\`environment: '${found.groups.dom}'\` gives every file of this project a drawing of a browser`,
            rule: 'e5b-no-simulated-dom-config-member',
            severity: 'error',
        },
    ];
}

function seamDependencies(member: {
    label: string;
    manifest: Manifest;
    memberDir: string;
    subject: string;
}): TokenViolation[] {
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
        rule: 'f8-no-seam-dependency' as const,
        severity: 'error' as const,
    }));
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

/** `rootDir` anchors the reported paths, so a member's finding reads the same alone as inside a whole-workspace run. */
const GROUND_SYNONYMS = new Set(['__snapshots__', 'golden', 'goldens', 'snapshots']);

const CODE_MODULE = /\.[cm]?[jt]sx?$/u;

/** Under the member's `specs/` tree always; elsewhere only when it holds no code: a `goldens/` folder of matcher source is named for what its code does. */
function holdsGround(path: string, memberDir: string): boolean {
    if (relative(memberDir, path).split(sep).includes('specs')) {
        return true;
    }
    try {
        return !treeNames(path).some((name) => CODE_MODULE.test(name));
    } catch {
        return false;
    }
}

/** The walk stops at a nested package and never enters ground: a fixture project may carry the word on purpose. */
function groundSynonyms(memberDir: string, label: string): TokenViolation[] {
    const found: TokenViolation[] = [];
    const walk = (dir: string): void => {
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (!entry.isDirectory() || SKIPPED.has(entry.name) || isGroundName(entry.name)) {
                continue;
            }
            if (GROUND_SYNONYMS.has(entry.name) && holdsGround(path, memberDir)) {
                found.push({
                    file: join(label, relative(memberDir, path), '/'),
                    line: 1,
                    fix: `rename \`${entry.name}/\` to \`expected/\`, beside the test that reads it`,
                    found: `\`${entry.name}/\`, a synonym of \`expected/\``,
                    rule: 'c25-no-ground-synonym',
                    severity: 'error',
                });
            } else if (dir === memberDir || treeKind(join(path, 'package.json')) !== 'file') {
                walk(path);
            }
        }
    };
    walk(memberDir);
    return found;
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

function workspacePatterns(manifest: Manifest): string[] {
    const { workspaces } = manifest;
    if (Array.isArray(workspaces)) {
        return workspaces;
    }
    return workspaces?.packages ?? [];
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
