import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { isUnderSpecs } from './ast.js';
import { reachesRunner } from './checker-facets.js';
import type { TokenViolation } from './checker.js';

/**
 * C12 placement — the suffix says the kind, so the tree has to agree with it.
 *
 * `.spec.ts` is the ASSEMBLED product's word: the app met through HTTP, a
 * binary run, a page served, a module put against real services. It lives under
 * `specs/<facet>/`. `.test.ts` is the UNIT's word: it sits beside the module it
 * covers. A file wearing one word in the other's place is the one shape that
 * makes the fork unreadable — a reader cannot tell what a test is FOR without
 * opening it — so both directions are errors with a mechanical fix, and the
 * checker's `--fix` performs the move.
 *
 * Two clauses, and each runs where it can see what it judges:
 *
 * - a `.spec.ts` with no `specs/` ancestor — the MEMBER pass, which walks a
 *   package and is the only run that sees a file outside a specs tree. The
 *   ancestor is read by the one anchor every other pass reads (`specsAnchor`),
 *   so a member whose own root IS the specs tree — a workspace declaring
 *   `packages: ['specs']` — holds specs, not strays;
 * - a `.test.ts` under `specs/<facet>/` where `<facet>` is one of the six
 *   constructors — the TREE pass. A first-level folder that is NOT a facet
 *   (the package's own `specs/lint/`, a repository's consistency suites) is a
 *   repository suite: it covers a tree rather than the assembled product, so
 *   it keeps `.test.ts` and C1's declared depth is what judges its shape.
 *
 * A tree may also be ONE facet's whole, with no `specs/<facet>/` level: the
 * runner sits at the root of `specs/` and the folders below it are domains (the
 * `depth: 'mirror'` shape, where the tree follows a command tree instead of a
 * facet/domain one). Such a tree carries a `*.specification.ts` at its root,
 * and that is what says so — every `.test.ts` below it specifies the assembled
 * product, whatever folder it sits in. Without this clause the whole shape was
 * invisible to C12 and its specs had to be renamed by hand.
 */

/** The six facet folders — a first-level name under `specs/` that IS a constructor. */
const FACETS = new Set(['api', 'cli', 'integration', 'jobs', 'mobile', 'website']);

/** Directories no placement walk enters. */
const SKIPPED = new Set(['.git', 'dist', 'node_modules']);

/**
 * Every file under `dir`, depth-first.
 *
 * `stopAtPackages` bounds the walk at the next `package.json`: the member pass
 * judges ONE member, and a nested member is judged by its own run — without the
 * bound, a workspace root reported every finding of every package below it and
 * the same file was named twice.
 *
 * @yields every file path under `dir`, depth-first.
 */
function* walk(dir: string, stopAtPackages = false): Generator<string> {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIPPED.has(entry.name)) {
                continue;
            }
            if (stopAtPackages && existsSync(join(path, 'package.json'))) {
                continue;
            }
            yield* walk(path, stopAtPackages);
            continue;
        }
        yield path;
    }
}

/** Read a file as text, or the empty string when it cannot be read. */
function textOf(path: string): string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return '';
    }
}

/** A move C12 asks for: where the file is, and where the suffix says it belongs. */
export type PlacementMove = {
    /** The convention's imperative line, for the diagnostic. */
    fix: string;
    /** Absolute path, as the tree holds it. */
    from: string;
    /** Absolute path, or `undefined` when only the author can choose the facet. */
    to?: string;
};

/**
 * Clause one — a `.spec.ts` that sits outside every `specs/` tree.
 *
 * The facet cannot be guessed (only the author knows whether the file meets the
 * product through HTTP or through a binary), so this clause reports and the
 * mover leaves it alone: `to` is `undefined` and the fix line names the shape.
 */
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
            message: `${rel}:1: a \`.spec.ts\` lives under \`specs/<facet>/\` — move it there, or rename it \`.test.ts\` beside the module it covers (C12 — see docs/19-linting.md)`,
            rule: 'c12-spec-file-name',
            severity: 'error',
        });
    }
    return violations;
}

/**
 * Clause two — a `.test.ts` under a facet folder of a `specs/` tree.
 *
 * The fix is mechanical and the mover performs it: the facet folder already
 * says what the file specifies, so the only thing missing is the word.
 *
 * A file that reaches no runner is left to C18, whose fix is the opposite move
 * — one file, one finding, and `--fix` never renames a module test into a spec.
 */
export function checkTestUnderFacet(specsRoot: string): TokenViolation[] {
    return movesUnderFacet(specsRoot).map(({ from }) => {
        const rel = relative(specsRoot, from);
        const first = rel.split(/[/\\]/u)[0] ?? '';
        // The tree the file sits in, as the reader sees it: a facet folder when
        // There is one, and `specs/` itself when the tree IS one facet's.
        const where = FACETS.has(first) ? `specs/${first}/` : 'specs/';
        return {
            file: rel,
            line: 1,
            message: `${rel}:1: a \`.test.ts\` under \`${where}\` specifies the assembled product — rename it \`.spec.ts\` (fixable: \`jterrazz-test-check <root> --fix\`) (C12 — see docs/19-linting.md)`,
            rule: 'c12-spec-file-name',
            severity: 'error' as const,
        };
    });
}

/**
 * Is this tree ONE facet's whole, rooted at `specs/`?
 *
 * A `*.specification.ts` at the ROOT of the tree is the statement: the runner
 * is the tree's, so every folder below it is a domain of that one facet and no
 * first level is a repository suite.
 */
function isRootedFacetTree(specsRoot: string): boolean {
    try {
        return readdirSync(specsRoot, { withFileTypes: true }).some(
            (entry) => entry.isFile() && entry.name.includes('.specification.'),
        );
    } catch {
        return false;
    }
}

/** The renames clause two asks for, as absolute from/to pairs. */
export function movesUnderFacet(specsRoot: string): PlacementMove[] {
    const moves: PlacementMove[] = [];
    const rooted = isRootedFacetTree(specsRoot);
    for (const path of walk(specsRoot)) {
        if (!path.endsWith('.test.ts')) {
            continue;
        }
        const parts = relative(specsRoot, path).split(/[/\\]/u);
        const facet = parts[0];
        // A file loose at the specs root has no facet to belong to (C1 owns
        // That), and a non-facet first level is a repository suite — unless the
        // Tree itself is one facet's, which its root specification says.
        if (!rooted && (parts.length < 2 || facet === undefined || !FACETS.has(facet))) {
            continue;
        }
        // A `<module>.test.ts` beside the `<module>.ts` it covers is I2's one
        // Pairing, legal anywhere — ground that is CODE keeps its unit test.
        if (parts.some((part) => part.startsWith('_'))) {
            continue;
        }
        // A file that reaches no runner is C18's, and C18 says to MOVE it
        // Beside its module. Renaming it here would answer the other rule's
        // Finding with the opposite fix, and `--fix` would turn a module test
        // Into a spec the tree then has to explain.
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
