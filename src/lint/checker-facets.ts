import type { Dirent } from 'node:fs';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { GROUND_DIRS, GROUND_FIXTURES } from '../core/chain/ground.js';
import type { TokenViolation } from './checker.js';
import { isNodeTestFileName, isTestFileName } from './role.js';

/**
 * The FACET passes — what a tree says about itself, read from the tree.
 *
 * A statique rule sees one file; these three need the shape around it: which
 * folder a file sits under, what the specification at that folder's root
 * constructs, which ground lives below it, and who reads that ground. The four
 * hold the one law the fork rests on — **folder = constructor** — from both
 * sides: a facet folder has the runner its name promises (C20), a spec under it
 * reaches that runner (C18), and ground one spec alone reads belongs to that
 * spec (C21w).
 *
 * A first-level folder that is NOT a facet is a repository suite — it covers a
 * tree rather than a product, C1's declared depth judges its shape, and none of
 * these passes reaches it.
 */

/** The six facet folders — a first-level name under `specs/` that IS a constructor. */
export const FACETS: string[] = ['api', 'cli', 'integration', 'jobs', 'mobile', 'website'];

/**
 * Directories no facet walk enters.
 *
 * The `$FIXTURES` pool is verbatim material — the reusable apps AND the trees
 * that fail on purpose — never live specs, so every pass prunes it exactly as
 * the token checker does.
 */
const SKIPPED = new Set(['.git', 'dist', GROUND_FIXTURES, 'node_modules']);

/** `readdirSync` that answers `[]` for anything it cannot read. */
function entriesOf(dir: string): Dirent[] {
    try {
        return readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
}

/** The specification files at a directory's own level. */
function specificationsIn(dir: string): string[] {
    return entriesOf(dir)
        .filter((entry) => entry.isFile() && entry.name.includes('.specification.'))
        .map((entry) => join(dir, entry.name));
}

/**
 * Every import SOURCE a file names — static, dynamic, and re-export.
 *
 * The source, not a substring of the file: `../website.specification` carries
 * no extension, so a scan for `.specification.js` read a spec that reaches its
 * runner as a module test parked in a facet tree, and told the author to move
 * the file that specifies the product.
 */
const IMPORT_SOURCE = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"](?<source>[^'"]+)['"]/gu;

/** The framework's own entry — a spec may construct the runner itself. */
const CONSTRUCTS = /\bspecification\.[a-z]+\s*\(/u;

/**
 * Does this file reach the runner of the facet it sits under?
 *
 * Two shapes answer yes: importing the facet's `*.specification` module
 * (however the import spells the extension), and constructing the runner in
 * the file itself — a refusal spec proves the constructor that must FAIL to
 * start, and has no specification module to import.
 */
export function reachesRunner(text: string): boolean {
    for (const match of text.matchAll(IMPORT_SOURCE)) {
        const source = match.groups?.source ?? '';
        if (source === '@jterrazz/test' || source.startsWith('@jterrazz/test/')) {
            return true;
        }
        if (source.slice(source.lastIndexOf('/') + 1).includes('.specification')) {
            return true;
        }
    }
    return CONSTRUCTS.test(text);
}

/** Read a file as text, or `null`. */
function textOf(path: string): null | string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

/**
 * Every file under `dir`, depth-first.
 *
 * @yields each file path.
 */
function* walkFiles(dir: string): Generator<string> {
    for (const entry of entriesOf(dir)) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIPPED.has(entry.name)) {
                yield* walkFiles(path);
            }
            continue;
        }
        yield path;
    }
}

/** The facet folders a specs root actually holds. */
function facetFoldersOf(specsRoot: string): { facet: string; path: string }[] {
    return entriesOf(specsRoot)
        .filter((entry) => entry.isDirectory() && FACETS.includes(entry.name))
        .map((entry) => ({ facet: entry.name, path: join(specsRoot, entry.name) }));
}

/**
 * C20 — a folder named for a facet holds the specification that constructs it.
 *
 * Positive-only: `specs/api/` promises `specification.api()`, and a reader who
 * opens it expecting a runner and finding none has been told something false by
 * the tree itself. Any OTHER first-level name is a repository suite and is
 * judged by C1's declared depth alone — the folder never has to be a facet.
 */
export function checkFacetFolder(specsRoot: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const { facet, path } of facetFoldersOf(specsRoot)) {
        const constructs = specificationsIn(path).some((file) =>
            (textOf(file) ?? '').includes(`specification.${facet}(`),
        );
        if (constructs) {
            continue;
        }
        const rel = relative(specsRoot, path);
        violations.push({
            file: rel,
            line: 1,
            message: `${rel}:1: \`specs/${facet}/\` is a facet folder with no \`${facet}.specification.ts\` constructing \`specification.${facet}()\` — create it, or rename the folder (C20 — see docs/13-linting.md)`,
            rule: 'c20-facet-folder',
            severity: 'error',
        });
    }
    return violations;
}

/**
 * C18 — a spec under a facet folder reaches the runner that folder promises.
 *
 * A test file that imports neither the facet's specification module nor the
 * framework is a MODULE test parked in a facet tree: it runs under the facet's
 * project, pays its budget and its services, and proves something that belongs
 * beside the module it covers.
 */
export function checkModuleTestUnderFacet(specsRoot: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const { facet, path } of facetFoldersOf(specsRoot)) {
        if (specificationsIn(path).length === 0) {
            // C20 owns the folder with no runner at all.
            continue;
        }
        for (const file of walkFiles(path)) {
            const name = file.slice(file.lastIndexOf('/') + 1);
            if (!isTestFileName(name)) {
                continue;
            }
            if (reachesRunner(textOf(file) ?? '')) {
                continue;
            }
            const rel = relative(specsRoot, file);
            violations.push({
                file: rel,
                line: 1,
                message: `${rel}:1: reaches no runner under the \`${facet}\` facet: import \`{ ${facet} }\` from \`${facet}.specification.js\`, or move a module test beside its module (C18 — see docs/13-linting.md)`,
                rule: 'c18-module-test-under-facet',
                severity: 'error',
            });
        }
    }
    return violations;
}

/**
 * Every directory under `dir`, depth-first.
 *
 * @yields each directory path.
 */
function* walkDirectories(dir: string): Generator<string> {
    for (const entry of entriesOf(dir)) {
        if (!entry.isDirectory() || SKIPPED.has(entry.name)) {
            continue;
        }
        const path = join(dir, entry.name);
        yield path;
        yield* walkDirectories(path);
    }
}

/** The ground names a leaf can hold. */
const GROUND = new Set<string>(GROUND_DIRS);

/**
 * A golden named by a TEMPLATE rather than by a literal — `toMatch(`${x}.json`)`.
 *
 * Such a test reads whatever the table hands it, so the names under the ground
 * appear nowhere in its source. It is a reader of every golden in its leaf,
 * and counting it as none made a shared `_expected/` read as one spec's own.
 */
const COMPUTED_GOLDEN = /\.toMatch\(\s*(?:`|[A-Za-z_$])/u;

/**
 * C21w (warning) — ground a single spec reads belongs to that spec.
 *
 * A leaf holding several specs and one `_expected/` that only one of them
 * names reads as shared material: the next author assumes someone else depends
 * on it and nobody dares touch it. The fix is C1's — the spec that stands on
 * its own ground earns its own domain folder.
 */
export function checkGroundOwnedByOne(specsRoot: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const directory of [specsRoot, ...walkDirectories(specsRoot)]) {
        const entries = entriesOf(directory);
        // A `.test.tsx` is out of reach, as it is for C1: a rendered unit sits
        // Beside its component, and a tree of them has no domain folders for
        // The ground to move into.
        const tests = entries
            .filter((entry) => entry.isFile() && isNodeTestFileName(entry.name))
            .map((entry) => join(directory, entry.name));
        if (tests.length < 2) {
            continue;
        }
        const grounds = entries
            .filter((entry) => entry.isDirectory() && GROUND.has(entry.name))
            .map((entry) => entry.name);
        for (const ground of grounds) {
            const names = [...walkFiles(join(directory, ground))].map((file) =>
                file.slice(file.lastIndexOf('/') + 1),
            );
            if (names.length === 0) {
                continue;
            }
            const readers = tests.filter((test) => {
                const text = textOf(test) ?? '';
                return (
                    names.some((name) => text.includes(name)) ||
                    text.includes(`${ground}/`) ||
                    COMPUTED_GOLDEN.test(text)
                );
            });
            if (readers.length !== 1) {
                continue;
            }
            const reader = readers[0] ?? '';
            const rel = relative(specsRoot, join(directory, ground));
            violations.push({
                file: rel,
                line: 1,
                message: `${rel}:1: \`${ground}/\` here is read by \`${relative(directory, reader)}\` alone — give it its own domain folder (C21 — see docs/13-linting.md)`,
                rule: 'c21w-ground-owned-by-one',
                severity: 'warn',
            });
        }
    }
    return violations;
}
