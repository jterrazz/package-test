import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { treeEntries } from '../../src/kernel/files/git-tree.js';
import type { TreeEntry } from '../../src/kernel/files/git-tree.js';
import { GROUND_DIRS, GROUND_FIXTURES, isGroundName } from '../../src/kernel/files/ground.js';
import { isNodeTestFileName, isTestFileName } from '../reading/role.js';
import type { TokenViolation } from './checker.js';

export const FACETS: string[] = ['api', 'cli', 'integration', 'job', 'mobile', 'website'];

const SKIPPED = new Set(['.git', 'dist', GROUND_FIXTURES, 'node_modules']);

function isUnderGround(relativePath: string): boolean {
    return relativePath.split(/[/\\]/u).some((segment) => isGroundName(segment));
}

function entriesOf(dir: string): TreeEntry[] {
    try {
        return treeEntries(dir);
    } catch {
        return [];
    }
}

function specificationsIn(dir: string): string[] {
    return entriesOf(dir)
        .filter((entry) => entry.isFile() && entry.name.includes('.specification.'))
        .map((entry) => join(dir, entry.name));
}

/** The source, not a substring: `../website.specification` carries no extension. */
const IMPORT_SOURCE = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"](?<source>[^'"]+)['"]/gu;

const CONSTRUCTS = /\bspecification\.[a-z]+\s*\(/u;

/** Constructing the runner in the file counts: a refusal spec proves the constructor that must fail to start, and has no specification module to import. */
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

function textOf(path: string): null | string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

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

function facetFoldersOf(specsRoot: string): { facet: string; path: string }[] {
    return entriesOf(specsRoot)
        .filter((entry) => entry.isDirectory() && FACETS.includes(entry.name))
        .map((entry) => ({ facet: entry.name, path: join(specsRoot, entry.name) }));
}

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
            fix: `create \`specs/${facet}/${facet}.specification.ts\` calling \`specification.${facet}()\`, or rename the folder`,
            found: `\`specs/${facet}/\`, a facet folder with no specification constructing \`specification.${facet}()\``,
            rule: 'facet-folder-has-specification',
            severity: 'error',
        });
    }
    return violations;
}

export function checkModuleTestUnderFacet(specsRoot: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const { facet, path } of facetFoldersOf(specsRoot)) {
        if (specificationsIn(path).length === 0) {
            // `facet-folder-has-specification` owns the folder with no runner at all.
            continue;
        }
        for (const file of walkFiles(path)) {
            const name = file.slice(file.lastIndexOf('/') + 1);
            if (!isTestFileName(name)) {
                continue;
            }
            // A test file under ground is a golden or its input, never a spec.
            if (isUnderGround(relative(path, file))) {
                continue;
            }
            if (reachesRunner(textOf(file) ?? '')) {
                continue;
            }
            const rel = relative(specsRoot, file);
            violations.push({
                file: rel,
                line: 1,
                fix: `import \`{ ${facet} }\` from \`${facet}.specification.js\` and drive the product through it, or move the module test beside its module`,
                found: `a test under the \`${facet}\` facet that reaches no runner`,
                rule: 'facet-test-uses-its-runner',
                severity: 'error',
            });
        }
    }
    return violations;
}

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

const SUBJECT_FOLDER_FACETS = new Set(['api', 'cli', 'job']);

const GROUND = new Set<string>(GROUND_DIRS);

/** Such a test reads every golden of its leaf though its source names none. */
const COMPUTED_GOLDEN = /\.toMatch\(\s*(?:file|directory)\(\s*(?:`|[A-Za-z_$])/u;

/** Not where the folder is the subject's standard name (`spec-in-subject-folder`): there the leaf is the subject, and its aspect files share it by design. */
export function checkGroundOwnedByOne(specsRoot: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const derived = (directory: string): boolean =>
        SUBJECT_FOLDER_FACETS.has(relative(specsRoot, directory).split(/[/\\]/u)[0] ?? '');
    for (const directory of [specsRoot, ...walkDirectories(specsRoot)].filter(
        (candidate) => !derived(candidate),
    )) {
        const entries = entriesOf(directory);
        // A `.test.tsx` is out of reach, as for `specs-at-declared-depth`: a tree of rendered units has no domain folders for the ground to move into.
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
                fix: `give \`${relative(directory, reader)}\` a domain folder of its own, and move \`${ground}/\` into it`,
                found: `\`${ground}/\`, read by \`${relative(directory, reader)}\` alone of the tests beside it`,
                rule: 'ground-beside-its-only-reader',
                severity: 'warn',
            });
        }
    }
    return violations;
}
