#!/usr/bin/env node
import { relative, resolve } from 'node:path';

import { lessonAt, rowNamed } from '../../engine/catalogue/lesson.js';
import { reportLine } from '../../engine/checker/finding.js';
import type { Finding } from '../../engine/checker/finding.js';
import { discoverSpecRoots } from '../../engine/project/members.js';
import { SELF_CHAPTER, selfRows } from '../catalogue/manifest.js';
import type { SelfPassId } from './checker.js';
import { runSelfSourceChecker, runSelfSpecsChecker, SELF_PASS_IDS } from './checker.js';

/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a reporter that wrote anywhere else would be reporting to nobody. */
/** `node dist/self-checker.js [dir]`, never in the tarball: no fixer, no ratchet, no JSON, since this repository is held at zero. */
const root = resolve(process.argv[2] ?? '.');

const findings: Finding<SelfPassId>[] = [...runSelfSourceChecker(root)];
for (const specsRoot of discoverSpecRoots(root)) {
    const prefix = relative(root, specsRoot);
    for (const violation of runSelfSpecsChecker(specsRoot)) {
        findings.push({
            ...violation,
            file: prefix === '' ? violation.file : `${prefix}/${violation.file}`,
        });
    }
}

for (const finding of findings) {
    const lesson = lessonAt(rowNamed(selfRows, finding.rule), finding, SELF_CHAPTER);
    console.error(reportLine(finding, lesson));
}

const errors = findings.filter((finding) => finding.severity === 'error').length;
if (errors > 0) {
    console.error(`\nself checker: ${errors} error(s) found under ${root}`);
    process.exit(1);
}
console.log(`self checker: no error under ${root} (${SELF_PASS_IDS.join(', ')})`);
