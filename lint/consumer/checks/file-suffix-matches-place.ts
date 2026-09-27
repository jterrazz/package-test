import { isGroundFolder, moveKeepingHistory, treeEntries } from '@jterrazz/typescript/rules';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { finding } from '../../engine/project/document-model.js';
import { FACETS, reachesRunner } from '../../engine/project/facets.js';
import { SPEC_EXTENSION } from '../../engine/project/spec-document.js';
import type { DocumentFinding, Finding } from './checker.js';
import { staleIncludes } from './file-suffix-matches-place.stale-includes.js';
import type { Rename } from './file-suffix-matches-place.stale-includes.js';

/** A tree with a `*.specification.ts` at its root is one facet's whole (`depth: 'mirror'`): every `.test.ts` below it specifies the assembled product. */

const SKIPPED = new Set(['.git', 'dist', 'node_modules']);

function* walk(dir: string): Generator<string> {
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
            yield* walk(path);
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

/** ls-lint never judges a file at the root it runs from, so a project's own root stays this rule's: every folder below it is `spec-file-in-a-specs-tree`'s. */
export function checkFileSuffixMatchesPlaceInMember(memberDir: string): Finding[] {
    let entries;
    try {
        entries = treeEntries(memberDir);
    } catch {
        return [];
    }
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
        .map(({ name }) => ({
            file: name,
            line: 1,
            fix: `move it under \`specs/<facet>/\`, or rename it \`${name.replace(/\.spec\.ts$/u, '.test.ts')}\` beside the module it covers`,
            found: "a `.spec.ts` at the project's root, outside every `specs/` tree",
            rule: 'file-suffix-matches-place',
        }));
}

/** A file reaching no runner is `facet-test-uses-its-runner`'s, whose fix is the opposite move: `--fix` never renames a module test into a spec. */
export function checkFileSuffixMatchesPlace(specsRoot: string): Finding[] {
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

function movesUnderFacet(specsRoot: string): PlacementMove[] {
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
        if (parts.some((part) => isGroundFolder(part))) {
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

export function checkFileSuffixMatchesPlaceOfDocument(rel: string): DocumentFinding[] {
    const name = basename(rel);
    const caseName = name.slice(0, -SPEC_EXTENSION.length);
    const findings: DocumentFinding[] = [];
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

export function fixFileSuffixMatchesPlace(root: string): string[] {
    const renamed: Rename[] = [];
    for (const { from, to } of movesUnderFacet(root)) {
        if (to === undefined || existsSync(to)) {
            continue;
        }
        moveKeepingHistory(from, to);
        renamed.push({ from, to });
    }
    return [
        ...renamed.map(
            ({ from, to }) =>
                `renamed ${relative(root, from)} → ${relative(root, to)} (file-suffix-matches-place)`,
        ),
        ...staleIncludes(root, renamed),
    ];
}
