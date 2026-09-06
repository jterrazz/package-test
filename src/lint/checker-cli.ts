#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { fixPoolFixtures } from './checker-crossfile.js';
import { fixSpecFiles } from './checker-spec.js';
import { formatViolations, runAllChecks } from './checker.js';

/**
 * CLI entry for the conventions checker (bundled as `dist/checker.js`).
 *
 *     node dist/checker.js [rootDir] [--fix]     # default root: cwd
 *
 * Runs every checker pass — the token/HTTP grammar (D4 / D4b / D10), the
 * `<case>.spec.yaml` document conventions, and the cross-file passes (C9 dead
 * fixtures, C14/C15 fixture placement, B5 await-using inference, A7 database
 * property). Exit 1 on any ERROR-level violation; warnings (D10, a downgraded C9
 * feature) are printed but do not fail the run.
 *
 * `--fix` applies the rewritable passes — the two document ones (key order and
 * block scalars) and C14, which MOVES a single-reader pool fixture beside its
 * leaf and rewrites the literals that named it — then checks what is left, so a
 * run that fixes everything exits 0. The move is a plain rename: the checker
 * never runs git, and the author stages what the working tree now shows.
 */
const fix = process.argv.includes('--fix');
const root = resolve(process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? '.');

// A missing root is operator error (a typo'd path), not a clean tree — fail
// Loudly rather than silently reporting "0 violations" over nothing.
if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`conventions checker: no such directory: ${root}`);
    process.exit(1);
}

if (fix) {
    const written = fixSpecFiles(root);
    if (written.length > 0) {
        console.log(`conventions checker: rewrote ${written.length} spec document(s)`);
    }
    for (const move of fixPoolFixtures(root)) {
        console.log(`conventions checker: moved ${move} (C14) — stage the rename`);
    }
}

const violations = runAllChecks(root);
const errors = violations.filter((violation) => violation.severity === 'error');

if (violations.length > 0) {
    const stream = errors.length > 0 ? console.error : console.warn;
    stream(formatViolations(violations));
}

if (errors.length > 0) {
    console.error(`\nconventions checker: ${errors.length} error(s) found under ${root}`);
    process.exit(1);
}

// The success line names what actually ran — every pass, not just the token
// Scan (the old "no unknown tokens" wording under-reported the C9/B5/A7 passes).
console.log(
    `conventions checker: all passes clean under ${root} (D4/D4b/D10 grammar, spec documents, C9 dead fixtures, C14/C15 fixture placement, B5 await-using, A7 database)${violations.length > 0 ? ` — ${violations.length} warning(s)` : ''}`,
);
