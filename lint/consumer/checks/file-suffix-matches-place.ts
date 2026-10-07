// invariant: a tree with a `*.specification.ts` at its root is one specification's whole (`depth: 'mirror'`): every `.test.ts` below it specifies the assembled product.

import { isGroundFolder, moveKeepingHistory, PRUNED } from '@jterrazz/typescript/rules';
import { existsSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { finding } from '../../kit/project/document-model.js';
import { SPEC_EXTENSION } from '../../kit/project/spec-grammar.js';
import { entriesOf } from '../../kit/project/specification-folders.js';
import { reachesRunner, SPECIFICATIONS } from '../../kit/project/specifications.js';
import { readText } from '../../kit/project/tree.js';
import type { DocumentFinding, Spotted } from './checker.js';
import { staleIncludes } from './file-suffix-matches-place.stale-includes.js';
import type { Rename } from './file-suffix-matches-place.stale-includes.js';

function* walk(dir: string): Generator<string> {
    for (const entry of entriesOf(dir)) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (PRUNED.has(entry.name)) {
                continue;
            }
            yield* walk(path);
            continue;
        }
        yield path;
    }
}

export type PlacementMove = { from: string; to: string };

/** ls-lint never judges a file at the root it runs from, so a project's own root stays this rule's: every folder below it is `spec-file-in-a-specs-tree`'s. */
export function checkFileSuffixMatchesPlaceInMember(memberDir: string): Spotted[] {
    return entriesOf(memberDir)
        .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
        .map(({ name }) => ({
            path: name,
            line: 1,
            // Stryker disable next-line Regex: the name filtered above ends on the suffix
            fix: `move it under \`specs/<specification>/\`, or rename it \`${name.replace(/\.spec\.ts$/u, '.test.ts')}\` in the \`__tests__/\` of the folder of the module it covers`,
            found: "a `.spec.ts` at the project's root, outside every `specs/` tree",
            rule: 'file-suffix-matches-place',
        }));
}

/** A file reaching no runner is `specification-test-uses-its-runner`'s, whose fix is the opposite move: `--fix` never renames a module test into a spec. */
export function checkFileSuffixMatchesPlace(specsRoot: string): Spotted[] {
    return movesUnderSpecification(specsRoot).map(({ from }) => {
        const rel = relative(specsRoot, from);
        const first = rel.split(/[/\\]/u)[0] ?? '';
        const where = SPECIFICATIONS.has(first) ? `specs/${first}/` : 'specs/';
        return {
            path: rel,
            line: 1,
            // Stryker disable next-line Regex: every move is of a name ending on the suffix
            fix: `rename it \`${rel.replace(/\.test\.ts$/u, '.spec.ts')}\` — \`typescript fix\` does it with \`git mv\``,
            found: `a \`.test.ts\` under \`${where}\`, where a file specifies the assembled product`,
            rule: 'file-suffix-matches-place',
        };
    });
}

function isRootedSpecificationTree(specsRoot: string): boolean {
    return entriesOf(specsRoot).some(
        (entry) => entry.isFile() && entry.name.includes('.specification.'),
    );
}

function movesUnderSpecification(specsRoot: string): PlacementMove[] {
    const moves: PlacementMove[] = [];
    const rooted = isRootedSpecificationTree(specsRoot);
    for (const path of walk(specsRoot)) {
        if (!path.endsWith('.test.ts')) {
            continue;
        }
        const parts = relative(specsRoot, path).split(/[/\\]/u);
        const [specification] = parts;
        // invariant: a file loose at the specs root is `specs-at-declared-depth`'s, and a non-specification first level is a repository suite, unless the tree itself is one specification's.
        // Stryker disable next-line StringLiteral: a split path always has a first part, and a test file's name is no specification's
        if (!rooted && !SPECIFICATIONS.has(specification ?? '')) {
            continue;
        }
        // invariant: a ground module's test is `test-in-its-tests-folder`'s, never a misnamed spec.
        if (parts.some((part) => isGroundFolder(part))) {
            continue;
        }
        if (!reachesRunner(readText(path))) {
            continue;
        }
        moves.push({
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
    for (const { from, to } of movesUnderSpecification(root)) {
        if (existsSync(to)) {
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
