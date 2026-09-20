import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

import { checkSpecOutsideSpecs } from './checker-placement.js';
import type { TokenViolation } from './checker.js';
import { isTestFileName } from './role.js';

/**
 * The MEMBER pass — what a workspace member owes, read from the member itself
 * rather than from a spec tree.
 *
 * The three findings here answer questions no file under `specs/` can: does
 * this member have a vitest config at all, does its config give every test it
 * collects a drawing of a browser, and does it declare a dependency the
 * framework already carries. A member with no `specs/` root is still judged —
 * that is the whole point, since the first of the three is about a member that
 * has tests and no configuration for them.
 *
 * The pass is the toolchain's door: `jterrazz-test-check --member <dir>` runs
 * it for one member, and a path-less `--format json` run at the project root
 * runs it for every member the root manifest declares.
 */

/** The two simulated DOMs — the same pair the statique E5b refuses. */
const SIMULATED_DOM = /\benvironment\s*:\s*['"](?<dom>happy-dom|jsdom)['"]/u;

/**
 * Dependencies `@jterrazz/test` carries. A member declaring one of these
 * duplicates a transitive it already resolves. Optional peers are not here:
 * `playwright`, `vite`, `react`, `better-sqlite3` and their kin are declared
 * BY the consumer on purpose.
 */
const CARRIED = new Set(['msw', 'vitest-mock-extended']);

/**
 * Carried, but only where it can only be the test seam's. `yaml` is a product
 * library as much as a fixture reader: a member that parses YAML at RUNTIME
 * declares it rightly, and a rule that read `dependencies` here would be
 * telling a product to drop a library the framework never ships to it. So the
 * finding is limited to the one declaration that can only mean the seam.
 */
const CARRIED_IN_DEV = new Set(['yaml']);

/**
 * The framework itself. It DECLARES what every other member inherits, so the
 * one manifest F8 must never read is its own — a rule that fired on the
 * package carrying the dependency would be asking it to remove the thing it
 * exists to provide.
 */
const FRAMEWORK = '@jterrazz/test';
const RETIRED = new Set(['@playwright/test', 'happy-dom', 'jsdom', 'mockdate']);
const RETIRED_SCOPES = ['@testing-library/'];

/**
 * The one retired seam a member may still declare, and what makes it allowed.
 *
 * React Native renders under jest until the react-native-web answer lands, and
 * where jest is the sanctioned runner `@testing-library/react-native` is the
 * only vocabulary there is: the rule would be asking for a facet that does not
 * reach that runtime yet. The allowance is read from the member itself — a
 * declared `jest`, a `jest` field, or a `test` script that calls it — so it
 * lapses the day the member stops running jest.
 */
const JEST_ONLY_SEAM = '@testing-library/react-native';

/** Does this member run jest? */
function runsJest(manifest: Manifest): boolean {
    const declares = (name: string): boolean =>
        name in (manifest.dependencies ?? {}) || name in (manifest.devDependencies ?? {});
    return (
        declares('jest') ||
        declares('jest-expo') ||
        manifest.jest !== undefined ||
        /(?:^|[\s/])jest(?:\s|$)/u.test(manifest.scripts?.test ?? '')
    );
}

/** Where a member states what it collects, whatever extension it writes it in. */
const CONFIG_NAMES = [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.cts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vitest.config.cjs',
];

/** Directories the member walk never enters. */
const SKIPPED = new Set(['.git', '.artifacts', 'coverage', 'dist', 'node_modules']);

type Manifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    jest?: unknown;
    name?: string;
    scripts?: Record<string, string>;
    workspaces?: string[] | { packages?: string[] };
};

/** A member's manifest, or null when it has none (it is then not a member). */
export function readManifest(dir: string): Manifest | null {
    const path = join(dir, 'package.json');
    if (!existsSync(path)) {
        return null;
    }
    try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`; the shape named here is the one every read below goes through, and a wrong one reads as absent
        return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
    } catch {
        return null;
    }
}

/** The member's vitest config, by path, or null. */
function configOf(dir: string): null | string {
    for (const name of CONFIG_NAMES) {
        const path = join(dir, name);
        if (existsSync(path)) {
            return path;
        }
    }
    return null;
}

/**
 * Does this member hold a test file it OWNS?
 *
 * A directory carrying its own `package.json` is another package's tree — a
 * workspace member, a vendored clone — and its tests are its own to configure.
 * A root that only delegates would otherwise be told to write a config for
 * files it never collects, which is the finding read backwards.
 */
function holdsTests(dir: string): boolean {
    const stack = [dir];
    let first = true;
    while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined) {
            break;
        }
        if (!first && existsSync(join(current, 'package.json'))) {
            continue;
        }
        first = false;
        let entries;
        try {
            entries = readdirSync(current, { withFileTypes: true });
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

/**
 * A `test` script that only hands the work to the members below it. It is not
 * evidence that THIS package runs vitest — `npm run test --workspaces`,
 * `pnpm -r test` and `turbo run test` all read as "ask the members".
 */
const DELEGATING_TEST =
    /--workspaces|(?:^|\s)-r(?:\s|$)|--recursive|turbo\s+run|nx\s+run-many|lerna\s+run/u;

/** What a declaration is: a transitive the framework resolves, or a seam it replaced. */
type Seam = { kind: 'carried' | 'retired'; name: string };

/** Every seam name this member declares that it should not, and why it should not. */
function declaredSeams(manifest: Manifest): Seam[] {
    if (manifest.name === FRAMEWORK) {
        return [];
    }
    const jestRuns = runsJest(manifest);
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

/** The line a manifest key is written on — a finding points at the declaration, not at `{`. */
function lineOfKey(dir: string, key: string): number {
    try {
        const lines = readFileSync(join(dir, 'package.json'), 'utf8').split('\n');
        const found = lines.findIndex((line) => line.includes(`"${key}"`));
        return found === -1 ? 1 : found + 1;
    } catch {
        return 1;
    }
}

/**
 * Run E3, E5b and F8 over ONE member. `memberDir` is absolute; `rootDir`
 * anchors the paths the findings report, so a member's finding reads the same
 * whether the pass ran over it alone or over the whole workspace.
 */
/** E3 — a member with tests of its own states how they run. */
function configPresent(
    manifest: Manifest,
    memberDir: string,
    label: string,
    subject: string,
): TokenViolation[] {
    // A delegating `test` script is the MEMBERS' tests, not this package's,
    // And the walk stops at the next `package.json` for the same reason.
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
            message:
                `${subject}: no vitest.config.ts — vitest's 5 s budget and an unexcluded \`_fixtures/\` ` +
                `are running your tests; write \`export default defineSpecConfig()\` ` +
                `(E3 — see docs/19-linting.md#e3-config-present)`,
            rule: 'e3',
            severity: 'error',
        },
    ];
}

/** E5b — a config that gives every file it collects a drawing of a browser. */
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
            message:
                `${relConfig}: \`environment: '${found.groups.dom}'\` gives every file of this project ` +
                `a drawing of a browser — a rendered thing is a \`.test.tsx\` beside its component, ` +
                `collected by \`component()\` (E5b — see docs/19-linting.md#e5b-no-simulated-dom-config-member)`,
            rule: 'e5b',
            severity: 'error',
        },
    ];
}

/**
 * F8 — a dependency the framework already carries, or a seam it replaced.
 *
 * The two are not the same sentence: removing a transitive changes nothing a
 * test can see, while dropping a retired seam means writing its facet.
 */
function seamDependencies(
    manifest: Manifest,
    memberDir: string,
    label: string,
    subject: string,
): TokenViolation[] {
    return declaredSeams(manifest).map((seam) => ({
        file: join(label, 'package.json'),
        line: lineOfKey(memberDir, seam.name),
        message:
            seam.kind === 'carried'
                ? `${subject}: \`${seam.name}\` is a transitive of \`@jterrazz/test\` — remove the declaration ` +
                  `(F8 — see docs/19-linting.md#f8-no-seam-dependency)`
                : `${subject}: \`${seam.name}\` is a seam \`@jterrazz/test\` replaced — the facet is \`component()\`, ` +
                  `\`website()\`, \`clock\` or \`intercept()\`; remove the declaration ` +
                  `(F8 — see docs/19-linting.md#f8-no-seam-dependency)`,
        rule: 'f8' as const,
        severity: 'error' as const,
    }));
}

/**
 * Re-anchor a member-relative finding on the root the run reports against, so
 * one member's path reads the same alone as inside a whole-workspace run.
 */
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

/**
 * Run E3, E5b and F8 over ONE member. `memberDir` is absolute; `rootDir`
 * anchors the paths the findings report, so a member's finding reads the same
 * whether the pass ran over it alone or over the whole workspace.
 */
export function checkMember(memberDir: string, rootDir: string): TokenViolation[] {
    const manifest = readManifest(memberDir);
    if (manifest === null) {
        return [];
    }
    const label = relative(rootDir, memberDir) || '.';
    // What a HUMAN calls this member. `--member .` is the ordinary run, and
    // `.: no vitest.config.ts` names nothing a reader can act on.
    const subject = label === '.' ? (manifest.name ?? basename(memberDir)) : label;
    const config = configOf(memberDir);

    return [
        ...(config === null ? configPresent(manifest, memberDir, label, subject) : []),
        ...(config === null ? [] : simulatedDom(config, rootDir)),
        ...seamDependencies(manifest, memberDir, label, subject),
        // C12's first clause: only a walk of the MEMBER sees a `.spec.ts`
        // That never reached a `specs/` tree.
        ...anchoredToRoot(checkSpecOutsideSpecs(memberDir), label),
    ];
}

/** The glob-ish workspace patterns a root manifest declares. */
function workspacePatterns(manifest: Manifest): string[] {
    const { workspaces } = manifest;
    if (Array.isArray(workspaces)) {
        return workspaces;
    }
    return workspaces?.packages ?? [];
}

/**
 * A glob over path SEGMENTS — `*` stops at a separator, `**` does not. The
 * same translation `@jterrazz/typescript`'s `lib/workspace-members.js` makes,
 * because the two lists have to be the same list: a member the toolchain runs
 * `--member` over and the path-less run never discovers is a finding the
 * ratchet can neither record nor clear.
 */
function toPattern(glob: string): RegExp {
    const escaped = glob
        .replaceAll(/[.+^${}()|[\]\\]/gu, String.raw`\$&`)
        .replaceAll('**', ' ')
        .replaceAll('*', '[^/]*')
        .replaceAll(' ', '.*');
    return new RegExp(`^${escaped}$`, 'u');
}

/** How deep a member may sit below the root — the toolchain's bound, to the segment. */
const MEMBER_DEPTH = 6;

/**
 * Every workspace member declared by the root manifest, plus the root itself —
 * a single-package repository IS its own member, and the pass has to reach it.
 */
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
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.') || SKIPPED.has(entry.name)) {
                continue;
            }
            const child = join(dir, entry.name);
            const path = relative(rootDir, child).split(sep).join('/');
            // A directory a pattern claims IS a member, and a member is never
            // Walked into: what it contains is its own workspace, not this one's.
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

/** Paths git is told to ignore — the toolchain skips them, so the two lists agree. */
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
        // No git, or no repository — an unignorable tree is judged whole.
        return new Set();
    }
}

/** How deep below a member a nested `specs/` may sit before the walk gives up. */
const SPECS_DEPTH = 6;

/**
 * Every `specs/` root the tree passes have to walk: the project's own, and
 * each member's — including a member that NESTS its facet tree (`web/specs`).
 * Stated here rather than guessed by the walk, so a path-less run reports
 * exactly what a per-root run would.
 *
 * A `specs/` tree is never descended into (the fixtures under it are not spec
 * roots), and neither is another package's tree: a directory carrying its own
 * `package.json` belongs to whichever member declares it. A member DIRECTORY
 * named `specs` is a root of its own — the tree can be the member.
 */
export function discoverSpecRoots(rootDir: string): string[] {
    const roots = new Set<string>();
    // A directory with no manifest is no member, and the walk still owes an
    // Answer about it: a tree named by hand is judged on what it HOLDS.
    const members = discoverMembers(rootDir);
    for (const member of members.length === 0 ? [rootDir] : members) {
        // A member whose own root IS the tree — a workspace declaring
        // `packages: ['specs']`. Without this, the run the toolchain merges
        // Into the ratchet walked no tree at all and the member's facet
        // Findings were reachable only by naming the path by hand.
        if (basename(member) === 'specs') {
            roots.add(member);
        }
        const walk = (dir: string, depth: number): void => {
            if (depth > SPECS_DEPTH) {
                return;
            }
            let entries;
            try {
                entries = readdirSync(dir, { withFileTypes: true });
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

/** Run the member pass over every member the root declares. */
export function checkMembers(rootDir: string): TokenViolation[] {
    return discoverMembers(rootDir).flatMap((member) => checkMember(member, rootDir));
}
