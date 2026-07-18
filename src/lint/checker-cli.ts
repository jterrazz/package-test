#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { formatViolations, runAllChecks } from './checker.js';

/**
 * CLI entry for the conventions checker (bundled as `dist/checker.js`).
 *
 *     node dist/checker.js [rootDir]     # default: cwd
 *
 * Runs every checker pass — the token/HTTP grammar (D4 / D4b / D10) and the
 * cross-file passes (C9 dead fixtures, B5 await-using inference, A7 database
 * property). Exit 1 on any ERROR-level violation; warnings (D10, a downgraded
 * C9 feature) are printed but do not fail the run.
 */
const root = resolve(process.argv[2] ?? '.');

// A missing root is operator error (a typo'd path), not a clean tree — fail
// Loudly rather than silently reporting "0 violations" over nothing.
if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`conventions checker: no such directory: ${root}`);
    process.exit(1);
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
    `conventions checker: all passes clean under ${root} (D4/D4b/D10 grammar, C9 dead fixtures, B5 await-using, A7 database)${violations.length > 0 ? ` — ${violations.length} warning(s)` : ''}`,
);
