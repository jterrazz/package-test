import { basename, dirname, join } from 'node:path';

import { isUnderSpecs, segments } from './ast.js';
import { isFile } from './fs-cache.js';

/**
 * What KIND of file a rule is looking at, decided from its path alone.
 *
 * One answer, read from one place: it is what lets a rule say "this is mine" in
 * a line, and what makes a rendered component reachable by the rules that should
 * see it and invisible to the ones that should not.
 *
 * The SUFFIX decides the kind, and nothing else: `.test.ts` beside a module,
 * `.test.tsx` beside a component, `.spec.ts` under `specs/`, `.spec.yaml` for a
 * document, `.specification.ts(x)` for the file that builds a runner. A rule
 * reads the three fields this module returns and NOTHING else of the path — the
 * gates that used to probe for a `src` or a `specs` segment disagreed with each
 * other and with the project that actually runs the file.
 */

/** The kinds the catalogue tells apart. */
export type FileRole =
    | 'component'
    | 'config'
    | 'contract'
    | 'document'
    | 'ground'
    | 'module'
    | 'other'
    | 'spec'
    | 'specification';

/** A test root the conventions retired — `roleOf` names it so I2 can refuse it. */
export type LegacyDir = '__tests__' | 'tests' | null;

/** What a rule reads about the file it was handed. */
export type FileIdentity = {
    /** Is an ancestor directory named `specs`? */
    inSpecs: boolean;
    /** The retired test root this path sits under, when it does. */
    legacyDir: LegacyDir;
    /** The kind the path states. */
    role: FileRole;
};

/** The four ground names — what the specs of a row stand ON, never a spec. */
const GROUND = new Set(['_expected', '_fixtures', '_requests', '_seeds']);

/** A vitest config, whatever extension the project writes it in. */
const CONFIG = /^vitest\.config\.[cm]?[jt]s$/u;

/**
 * The retired test root this path sits under.
 *
 * `__tests__/` is retired wherever it appears. A `tests/` directory is only the
 * retired ROOT when it sits directly under a package — a `tests` segment deeper
 * in a tree is an ordinary domain name, and a checkout living under `~/tests/`
 * is nobody's business but the filesystem's.
 */
function legacyDirOf(parts: string[]): LegacyDir {
    if (parts.slice(0, -1).includes('__tests__')) {
        return '__tests__';
    }
    const testsIndex = parts.indexOf('tests');
    if (testsIndex > 0 && isFile(`/${parts.slice(0, testsIndex).join('/')}/package.json`)) {
        return 'tests';
    }
    return null;
}

/**
 * The kind of file this path names.
 *
 * The suffix decides, and the order matters: a `*.specification.ts` is a
 * specification wherever it sits, `.spec.*` is the assembled product's word and
 * `.test.*` the unit's, `.tsx` versus `.ts` is what tells a RENDERED unit from a
 * plain one — the same distinction the two project helpers collect on, so a file
 * is judged by the rules of the project that actually runs it. Ground swallows
 * only what carries no suffix of its own.
 */
export function roleOf(filename: string): FileIdentity {
    const parts = segments(filename);
    const base = parts.at(-1) ?? '';
    const identity = { inSpecs: isUnderSpecs(filename), legacyDir: legacyDirOf(parts) };

    if (base.endsWith('.specification.ts') || base.endsWith('.specification.tsx')) {
        return { ...identity, role: 'specification' };
    }
    if (base.endsWith('.spec.yaml')) {
        return { ...identity, role: 'document' };
    }
    if (base.endsWith('.spec.ts')) {
        return { ...identity, role: 'spec' };
    }
    if (base.endsWith('.test.tsx')) {
        return { ...identity, role: 'component' };
    }
    if (base.endsWith('.test.ts')) {
        return { ...identity, role: 'module' };
    }
    if (CONFIG.test(base)) {
        return { ...identity, role: 'config' };
    }
    if (parts.slice(0, -1).some((segment) => GROUND.has(segment))) {
        return { ...identity, role: 'ground' };
    }
    if (parts.slice(0, -1).includes('contracts')) {
        return { ...identity, role: 'contract' };
    }
    return { ...identity, role: 'other' };
}

/** The roles that ARE a test — what a rule reaching "every test file" means. */
const TEST_ROLES = new Set<FileRole>(['component', 'module', 'spec']);

/**
 * The three suffixes that DECLARE tests, as a name-level predicate.
 *
 * `roleOf` is the answer for a rule handed a file; the passes that WALK a tree
 * only ever hold a name, and this is the same vocabulary for them — one place
 * to read, so a tree walk and a rule never disagree on what a test is.
 */
export function isTestFileName(name: string): boolean {
    return name.endsWith('.test.ts') || name.endsWith('.test.tsx') || name.endsWith('.spec.ts');
}

/** A test that runs under node's project — a `.test.tsx` renders and is not one. */
export function isNodeTestFileName(name: string): boolean {
    return name.endsWith('.test.ts') || name.endsWith('.spec.ts');
}

/** Is this one of the three files that DECLARE tests? */
export function isTestRole(role: FileRole): boolean {
    return TEST_ROLES.has(role);
}

/** Is this a file the test conventions reach — a test, or anything under `specs/`? */
export function isTestFile(filename: string): boolean {
    const { inSpecs, role } = roleOf(filename);
    return isTestRole(role) || role === 'specification' || role === 'document' || inSpecs;
}

/** The directory the file sits in — what a layout pass walks from. */
export function directoryOf(filename: string): string {
    return dirname(filename);
}

/** The nearest package root at or above a directory, when there is one. */
export function packageRootOf(directory: string): string | undefined {
    let current = directory;
    for (;;) {
        if (isFile(join(current, 'package.json'))) {
            return current;
        }
        const parent = dirname(current);
        if (parent === current) {
            return undefined;
        }
        current = parent;
    }
}

/** The basename, for the one message that names the neighbour a test wants. */
export function baseNameOf(filename: string): string {
    return basename(filename);
}
