import { readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { SPEC_EXTENSION } from '../../src/facets/cli/documents/spec-document.js';
import { treeEntries, treeKind } from '../../src/kernel/files/git-tree.js';
import { isGroundName } from '../../src/kernel/files/ground.js';
import { isUnderSpecs } from '../reading/ast.js';
import { FACETS, reachesRunner } from '../reading/facets.js';
import type { TokenViolation } from './checker.js';
import { finding } from './document-model.js';
import type { Finding } from './document-model.js';

/** A tree with a `*.specification.ts` at its root is one facet's whole (`depth: 'mirror'`): every `.test.ts` below it specifies the assembled product. */

const SKIPPED = new Set(['.git', 'dist', 'node_modules']);

// `stopAtPackages` bounds the walk at the next `package.json`: a nested member is judged by its own run, never named twice.
function* walk(dir: string, stopAtPackages = false): Generator<string> {
    let entries;
    try {
        entries = treeEntries(dir);
    } catch {
        return;
    }
    for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIPPED.has(entry.name)) {
                continue;
            }
            if (stopAtPackages && treeKind(join(path, 'package.json')) === 'file') {
                continue;
            }
            yield* walk(path, stopAtPackages);
            continue;
        }
        yield path;
    }
}

function textOf(path: string): string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return '';
    }
}

export type PlacementMove = {
    fix: string;
    from: string;
    /** `undefined` when only the author can choose the facet. */
    to?: string;
};

/** Only the author knows whether the file meets the product through HTTP or through a binary, so the mover leaves it. */
export function checkSpecOutsideSpecs(memberDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const path of walk(memberDir, true)) {
        if (!path.endsWith('.spec.ts')) {
            continue;
        }
        if (isUnderSpecs(path)) {
            continue;
        }
        const rel = relative(memberDir, path);
        violations.push({
            file: rel,
            line: 1,
            fix: `move it under \`specs/<facet>/\`, or rename it \`${rel.replace(/\.spec\.ts$/u, '.test.ts')}\` beside the module it covers`,
            found: 'a `.spec.ts` outside every `specs/` tree',
            rule: 'file-suffix-matches-place',
            severity: 'error',
        });
    }
    return violations;
}

/** A file reaching no runner is `facet-test-uses-its-runner`'s, whose fix is the opposite move: `--fix` never renames a module test into a spec. */
export function checkTestUnderFacet(specsRoot: string): TokenViolation[] {
    return movesUnderFacet(specsRoot).map(({ from }) => {
        const rel = relative(specsRoot, from);
        const first = rel.split(/[/\\]/u)[0] ?? '';
        const where = FACETS.has(first) ? `specs/${first}/` : 'specs/';
        return {
            file: rel,
            line: 1,
            fix: `rename it \`${rel.replace(/\.test\.ts$/u, '.spec.ts')}\` — \`make fix\` does it with \`git mv\``,
            found: `a \`.test.ts\` under \`${where}\`, where a file specifies the assembled product`,
            rule: 'file-suffix-matches-place',
            severity: 'error' as const,
        };
    });
}

function isRootedFacetTree(specsRoot: string): boolean {
    try {
        return treeEntries(specsRoot).some(
            (entry) => entry.isFile() && entry.name.includes('.specification.'),
        );
    } catch {
        return false;
    }
}

export function movesUnderFacet(specsRoot: string): PlacementMove[] {
    const moves: PlacementMove[] = [];
    const rooted = isRootedFacetTree(specsRoot);
    for (const path of walk(specsRoot)) {
        if (!path.endsWith('.test.ts')) {
            continue;
        }
        const parts = relative(specsRoot, path).split(/[/\\]/u);
        const facet = parts[0];
        // A file loose at the specs root is `specs-at-declared-depth`'s, and a non-facet first level is a repository suite, unless the tree itself is one facet's.
        if (!rooted && (parts.length < 2 || facet === undefined || !FACETS.has(facet))) {
            continue;
        }
        // A `<module>.test.ts` beside its `<module>.ts` is `test-beside-its-module`'s pairing, legal anywhere.
        if (parts.some((part) => isGroundName(part))) {
            continue;
        }
        if (!reachesRunner(textOf(path))) {
            continue;
        }
        moves.push({
            fix: 'rename to `.spec.ts`',
            from: path,
            to: `${path.slice(0, -'.test.ts'.length)}.spec.ts`,
        });
    }
    return moves;
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const REDUNDANT_WORDS = new Set(['cli', 'spec', 'test']);

export function checkFileName(rel: string): Finding[] {
    const name = basename(rel);
    const caseName = name.slice(0, -SPEC_EXTENSION.length);
    const findings: Finding[] = [];
    if (!KEBAB.test(caseName)) {
        findings.push(
            finding('file-suffix-matches-place', 1, {
                fix: `rename it in kebab-case — lowercase words joined by single hyphens, \`<case>${SPEC_EXTENSION}\``,
                found: `"${name}" is not kebab-case`,
            }),
        );
        return findings;
    }
    const redundant = caseName.split('-').filter((word) => REDUNDANT_WORDS.has(word));
    if (redundant.length > 0) {
        findings.push(
            finding('file-suffix-matches-place', 1, {
                fix: `drop "${redundant[0]}" from the name and name the case it proves`,
                found: `"${name}" repeats "${redundant[0]}", which the \`${SPEC_EXTENSION}\` suffix already says`,
            }),
        );
    }
    const folder = basename(dirname(rel));
    if (caseName === folder) {
        findings.push(
            finding('file-suffix-matches-place', 1, {
                fix: 'name it for what this case proves, not where it sits',
                found: `"${name}" repeats its directory "${folder}/"`,
            }),
        );
    }
    return findings;
}
