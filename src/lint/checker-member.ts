import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { TokenViolation } from './checker.js';

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
 * Dependencies `@jterrazz/test` carries, and the seams it REPLACED. A member
 * declaring one of these either duplicates a transitive it already resolves,
 * or keeps a vocabulary the framework has a facet for. Optional peers are not
 * here: `playwright`, `vite`, `react`, `better-sqlite3` and their kin are
 * declared BY the consumer on purpose.
 */
const CARRIED = new Set(['msw', 'vitest-mock-extended', 'yaml']);

/**
 * The framework itself. It DECLARES what every other member inherits, so the
 * one manifest F8 must never read is its own — a rule that fired on the
 * package carrying the dependency would be asking it to remove the thing it
 * exists to provide.
 */
const FRAMEWORK = '@jterrazz/test';
const RETIRED = new Set(['@playwright/test', 'happy-dom', 'jsdom', 'mockdate']);
const RETIRED_SCOPES = ['@testing-library/'];

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

/** Does this member hold a test file anywhere it owns? */
function holdsTests(dir: string): boolean {
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined) {
            break;
        }
        let entries;
        try {
            entries = readdirSync(current, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!SKIPPED.has(entry.name)) {
                    stack.push(join(current, entry.name));
                }
                continue;
            }
            if (/\.test\.[cm]?tsx?$/u.test(entry.name)) {
                return true;
            }
        }
    }
    return false;
}

/** Every seam name this member declares that it should not. */
function declaredSeams(manifest: Manifest): string[] {
    if (manifest.name === FRAMEWORK) {
        return [];
    }
    const declared = {
        ...manifest.dependencies,
        ...manifest.devDependencies,
    };
    return Object.keys(declared)
        .filter(
            (name) =>
                CARRIED.has(name) ||
                RETIRED.has(name) ||
                RETIRED_SCOPES.some((scope) => name.startsWith(scope)),
        )
        .toSorted();
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
    const violations: TokenViolation[] = [];
    const label = relative(rootDir, memberDir) || '.';
    const config = configOf(memberDir);

    // E3 — a member with tests states how they run.
    const hasTestScript = typeof manifest.scripts?.test === 'string';
    if (config === null && (hasTestScript || holdsTests(memberDir))) {
        violations.push({
            file: join(label, 'package.json'),
            line: 1,
            message:
                `${label}: no vitest.config.ts — vitest's 5 s budget and an unexcluded \`_fixtures/\` ` +
                `are running your tests; write \`export default defineSpecConfig()\` ` +
                `(E3 — see docs/13-linting.md#e3-config-present)`,
            rule: 'e3',
            severity: 'error',
        });
    }

    // E5b — a config that gives every file it collects a drawing of a browser.
    if (config !== null) {
        const text = readFileSync(config, 'utf8');
        const found = SIMULATED_DOM.exec(text);
        if (found?.groups?.dom !== undefined) {
            const relConfig = relative(rootDir, config);
            violations.push({
                file: relConfig,
                line: text.slice(0, found.index).split('\n').length,
                message:
                    `${relConfig}: \`environment: '${found.groups.dom}'\` gives every file of this project ` +
                    `a drawing of a browser — a rendered thing is a \`.test.tsx\` beside its component, ` +
                    `collected by \`component()\` (E5b — see docs/13-linting.md#e5b-no-simulated-dom-config)`,
                rule: 'e5b',
                severity: 'error',
            });
        }
    }

    // F8 — a dependency the framework already carries, or a seam it replaced.
    for (const seam of declaredSeams(manifest)) {
        violations.push({
            file: join(label, 'package.json'),
            line: 1,
            message:
                `${label}: \`${seam}\` is a transitive of \`@jterrazz/test\` — remove the declaration ` +
                `(F8 — see docs/13-linting.md#f8-no-seam-dependency)`,
            rule: 'f8',
            severity: 'error',
        });
    }

    return violations;
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
 * Expand one workspace pattern to the directories it names. Only the two
 * shapes npm, bun and pnpm all agree on are honoured — a literal path and a
 * trailing `*` — because a checker that guessed at a wider glob language would
 * report findings for members the installer never resolved.
 */
function expandPattern(rootDir: string, pattern: string): string[] {
    const cleaned = pattern.replace(/\/+$/u, '');
    if (!cleaned.includes('*')) {
        const path = resolve(rootDir, cleaned);
        return existsSync(path) ? [path] : [];
    }
    const [prefix] = cleaned.split('*');
    const base = resolve(rootDir, (prefix ?? '').replace(/\/+$/u, ''));
    try {
        return readdirSync(base, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && !SKIPPED.has(entry.name))
            .map((entry) => join(base, entry.name));
    } catch {
        return [];
    }
}

/**
 * Every workspace member declared by the root manifest, plus the root itself —
 * a single-package repository IS its own member, and the pass has to reach it.
 */
export function discoverMembers(rootDir: string): string[] {
    const manifest = readManifest(rootDir);
    if (manifest === null) {
        return [];
    }
    const members = new Set<string>([rootDir]);
    for (const pattern of workspacePatterns(manifest)) {
        for (const dir of expandPattern(rootDir, pattern)) {
            if (readManifest(dir) !== null) {
                members.add(dir);
            }
        }
    }
    return [...members];
}

/**
 * Every `specs/` root the tree passes have to walk: the project's own, and
 * each member's. Stated here rather than guessed by the walk, so a path-less
 * run reports exactly what a per-root run would.
 */
export function discoverSpecRoots(rootDir: string): string[] {
    const roots: string[] = [];
    for (const member of discoverMembers(rootDir)) {
        const specs = join(member, 'specs');
        try {
            if (statSync(specs).isDirectory()) {
                roots.push(specs);
            }
        } catch {
            // No specs root here — the member pass still judges it.
        }
    }
    return roots;
}

/** Run the member pass over every member the root declares. */
export function checkMembers(rootDir: string): TokenViolation[] {
    return discoverMembers(rootDir).flatMap((member) => checkMember(member, rootDir));
}
