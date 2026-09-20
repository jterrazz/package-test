#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { fixPoolFixtures } from './checker-crossfile.js';
import { checkMember, checkMembers, discoverSpecRoots } from './checker-member.js';
import { movesUnderFacet } from './checker-placement.js';
import { fixSpecFiles } from './checker-spec.js';
import { formatViolations, MEMBER_PASS_IDS, runAllChecks, TREE_PASS_IDS } from './checker.js';
import type { TokenViolation } from './checker.js';
import { packageRootOf } from './role.js';
import { codeOf } from './rule-code.js';

/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a reporter that wrote anywhere else would be reporting to nobody. */
/**
 * CLI entry for the conventions checker (bundled as `dist/checker.js`).
 *
 *     node dist/checker.js [rootDir] [--fix]          # a specs tree
 *     node dist/checker.js --format json              # every root, every member
 *     node dist/checker.js --member <dir>             # one workspace member
 *
 * Three runs, one reporter. With a PATH it walks that tree and runs every
 * checker pass over it — the token/HTTP grammar (D4 / D4b / D10), the
 * `<case>.spec.yaml` document conventions, and the cross-file passes (C9 dead
 * fixtures, C14/C15 fixture placement, B5 await-using inference, A7 database
 * property). With `--member <dir>` it runs the member pass (E3 config-present,
 * E5b no simulated DOM in a config, F8 no seam dependency) over one workspace
 * member, whether or not that member has a `specs/` root.
 *
 * With NO path it runs both over the whole project: every `specs/` root it
 * discovers from the root manifest's workspaces, and every member. That is the
 * run `@jterrazz/typescript`'s ratchet rests on, so the contract is exactly
 * "a path-less run reports what the per-root and per-member runs report".
 *
 * `--format json` prints `[{ code, file, line, severity, message }]` on stdout
 * and nothing else, where `code` is `jterrazz-check(<id>)` — the namespace the
 * ratchet records under. Exit 1 on any ERROR-level violation either way;
 * warnings are reported but never fail the run.
 *
 * `--fix` applies the rewritable passes — the two document ones (key order and
 * block scalars), C14, which MOVES a single-reader pool fixture beside its leaf
 * and rewrites the literals that named it, and C12, which RENAMES a `.test.ts`
 * under a facet folder to `.spec.ts` — then checks what is left, so a run that
 * fixes everything exits 0. With no path it applies them to every `specs/` root
 * it discovers: `--fix` means the same thing whichever run the operator typed.
 *
 * After a C12 rename it NAMES every include glob of the owning member that
 * still says `.test.ts`. A glob the rename left behind collects nothing, the
 * run stays green with fewer files, and nothing else in the toolchain would
 * have said a word.
 *
 * C12's rename goes through `git mv` where the tree is a git working tree, so
 * the history follows the file across a migration that touches hundreds of
 * them; outside one it falls back to a plain rename. C14's move stays a plain
 * rename and the author stages what the working tree now shows.
 */

const argv = process.argv.slice(2);
const fix = argv.includes('--fix');
const json = valueOf('--format') === 'json';
const member = valueOf('--member');
const positional = argv.find((argument, index) => {
    if (argument.startsWith('--')) {
        return false;
    }
    // The value of a `--flag value` pair is not a path.
    const previous = argv[index - 1];
    return previous !== '--format' && previous !== '--member';
});

/** The value of `--flag value` or `--flag=value`, or undefined. */
function valueOf(flag: string): string | undefined {
    const inline = argv.find((argument) => argument.startsWith(`${flag}=`));
    if (inline !== undefined) {
        return inline.slice(flag.length + 1);
    }
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
}

/**
 * What a run names when it is clean — the pass REGISTRY, never a sentence
 * written beside it.
 *
 * The hand-written list stopped at the cross-file passes of 15.x while the
 * channel grew four tree passes and a suppression gate, so the summary
 * under-reported exactly what it exists to report.
 */
const TREE_PASSES = TREE_PASS_IDS.join(', ');
/** The passes a member run puts over a package. */
const MEMBER_PASSES = MEMBER_PASS_IDS.join(', ');

/**
 * Print the findings and exit on the first error-level one. `passes` names the
 * ones that ACTUALLY ran: a member run that claimed the tree passes would be
 * telling the reader a `specs/` tree was judged when none was walked.
 */
function report(violations: TokenViolation[], what: string, passes: string): never {
    const errors = violations.filter((violation) => violation.severity === 'error');

    if (json) {
        console.log(
            JSON.stringify(
                violations.map((violation) => ({
                    // The published code is the CONVENTION code — the id's
                    // First segment — whatever a pass calls itself internally:
                    // It is the key the toolchain's ratchet records under, and
                    // Two spellings of one rule would be two lines of debt.
                    code: `jterrazz-check(${codeOf(violation.rule)})`,
                    file: violation.file,
                    line: violation.line,
                    message: violation.message,
                    severity: violation.severity,
                })),
            ),
        );
        process.exit(errors.length > 0 ? 1 : 0);
    }

    if (violations.length > 0) {
        const stream = errors.length > 0 ? console.error : console.warn;
        stream(formatViolations(violations));
    }
    if (errors.length > 0) {
        console.error(`\nconventions checker: ${errors.length} error(s) found ${what}`);
        process.exit(1);
    }
    // The success line names what actually ran — every pass, not just the token
    // Scan (the old "no unknown tokens" wording under-reported the C9/B5/A7 passes).
    console.log(
        `conventions checker: all passes clean ${what} (${passes})${violations.length > 0 ? ` — ${violations.length} warning(s)` : ''}`,
    );
    process.exit(0);
}

/** A directory that must exist — a typo'd path is operator error, not a clean tree. */
function requireDirectory(path: string, what: string): string {
    const resolved = resolve(path);
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
        console.error(`conventions checker: no such ${what}: ${resolved}`);
        process.exit(1);
    }
    return resolved;
}

// ── One member ──

if (member !== undefined) {
    const root = resolve(positional ?? '.');
    const dir = requireDirectory(member, 'member directory');
    report(checkMember(dir, root), `for member ${relative(root, dir) || '.'}`, MEMBER_PASSES);
}

/**
 * Rename one file, keeping git's record of it where there is one.
 *
 * `git mv` is tried first and its failure is not an error: a path outside a
 * working tree, or one git does not track yet, renames exactly as well with
 * `renameSync` — what must not happen is a migration that loses the history of
 * every spec it touches because the tool reached for the blunter call.
 */
function renameKeepingHistory(from: string, to: string): void {
    const moved = spawnSync('git', ['mv', from, to], {
        cwd: dirname(from),
        stdio: 'ignore',
    });
    if (moved.status !== 0) {
        renameSync(from, to);
    }
}

/** C12's mover: every `.test.ts` under a facet folder becomes a `.spec.ts`. */
function fixSpecSuffixes(root: string): string[] {
    const renamed: string[] = [];
    for (const { from, to } of movesUnderFacet(root)) {
        if (to === undefined || existsSync(to)) {
            continue;
        }
        renameKeepingHistory(from, to);
        renamed.push(`${relative(root, from)} → ${relative(root, to)}`);
    }
    return renamed;
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

/** Any string in a config that ends in the suffix the mover just retired. */
const TEST_GLOB = /['"`](?<glob>[^'"`]*\*[^'"`]*\.test\.ts)['"`]/gu;

/**
 * The include globs a rename leaves behind.
 *
 * A consumer that names its suffix in an `include` loses the whole suite the
 * moment the mover renames it: vitest collects fewer files, exits 0, and the
 * only trace is a number nobody compares. The mover owns that consequence —
 * it cannot rewrite a config it does not parse, so it NAMES every glob that
 * still says `.test.ts` in the configs of the member it just moved files
 * under, and the author updates them in the same commit as the rename.
 */
function staleIncludes(root: string): string[] {
    const owner = packageRootOf(root) ?? dirname(root);
    const found: string[] = [];
    for (const directory of new Set([root, owner, dirname(root)])) {
        for (const name of CONFIG_NAMES) {
            const path = join(directory, name);
            if (!existsSync(path)) {
                continue;
            }
            const text = readFileSync(path, 'utf8');
            for (const match of text.matchAll(TEST_GLOB)) {
                const glob = match.groups?.glob ?? '';
                if (glob !== '') {
                    found.push(`${relative(owner, path)}: ${glob}`);
                }
            }
        }
    }
    return found;
}

/** Apply every rewritable pass over one tree, printing what it did. */
function applyFixes(root: string): void {
    const renamed = fixSpecSuffixes(root);
    for (const rename of renamed) {
        console.log(`conventions checker: renamed ${rename} (C12)`);
    }
    for (const glob of renamed.length === 0 ? [] : staleIncludes(root)) {
        console.log(
            `conventions checker: ${glob} still names \`.test.ts\` — the files it collected are \`.spec.ts\` now, and the project collects nothing until the glob follows (C12)`,
        );
    }
    const written = fixSpecFiles(root);
    if (written.length > 0) {
        console.log(`conventions checker: rewrote ${written.length} spec document(s)`);
    }
    for (const move of fixPoolFixtures(root)) {
        console.log(`conventions checker: moved ${move} (C14) — stage the rename`);
    }
}

// ── One specs tree ──

if (positional !== undefined) {
    const root = requireDirectory(positional, 'directory');
    if (fix) {
        applyFixes(root);
    }
    report(runAllChecks(root), `under ${root}`, TREE_PASSES);
}

// ── The whole project: every specs root, every member ──

const root = resolve('.');
const found: TokenViolation[] = [];
for (const specsRoot of discoverSpecRoots(root)) {
    const prefix = relative(root, specsRoot);
    if (fix) {
        applyFixes(specsRoot);
    }
    for (const violation of runAllChecks(specsRoot)) {
        // A tree pass reports relative to the tree it walked; the project-wide
        // Run has to say WHICH tree, or two members' findings read alike — in
        // The path it reports AND in the line a human reads, which begins with
        // That path.
        found.push({
            ...violation,
            file: `${prefix}/${violation.file}`,
            message: `${prefix}/${violation.message}`,
        });
    }
}
found.push(...checkMembers(root));
report(found, `under ${root}`, `${TREE_PASSES}, ${MEMBER_PASSES}`);
