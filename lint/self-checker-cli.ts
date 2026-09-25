#!/usr/bin/env node
import { relative, resolve } from 'node:path';

import { discoverSpecRoots } from './checker-member.js';
import { reportLine } from './checker.js';
import type { TokenViolation } from './checker.js';
import { lessonAt } from './lesson.js';
import { runSelfChecks, runSelfSourceChecks, SELF_PASS_IDS } from './self-checker.js';
import { SELF_CHAPTER, selfRowOf } from './self-manifest.js';

/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a reporter that wrote anywhere else would be reporting to nobody. */
/**
 * CLI entry for the self checker (bundled as `dist/self-checker.js`, left
 * out of the tarball by `files`).
 *
 *     node dist/self-checker.js [dir]     # a project root, or a specs tree — default: cwd
 *
 * It runs the passes of {@link SELF_PASS_IDS} over every specs tree under
 * `dir` and over the source tree of `dir` itself, prints each finding on the published checker's report line, and
 * exits 1 on an error. No fixer, no ratchet, no JSON: a self pass judges
 * this repository alone, which is held at zero.
 */
const root = resolve(process.argv[2] ?? '.');

const findings: TokenViolation[] = [...runSelfSourceChecks(root)];
for (const specsRoot of discoverSpecRoots(root)) {
    const prefix = relative(root, specsRoot);
    for (const violation of runSelfChecks(specsRoot)) {
        findings.push({
            ...violation,
            file: prefix === '' ? violation.file : `${prefix}/${violation.file}`,
        });
    }
}

for (const finding of findings) {
    const lesson = lessonAt(selfRowOf(finding.rule), finding, SELF_CHAPTER);
    console.error(reportLine(finding, lesson));
}

const errors = findings.filter((finding) => finding.severity === 'error').length;
if (errors > 0) {
    console.error(`\nself checker: ${errors} error(s) found under ${root}`);
    process.exit(1);
}
console.log(`self checker: no error under ${root} (${SELF_PASS_IDS.join(', ')})`);
