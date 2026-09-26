import { relative, resolve } from 'node:path';

import { lessonAt, rowNamed } from '../catalogue/lesson.js';
import { discoverSpecRoots } from '../project/members.js';
import { reportLine } from './finding.js';
import type { Finding } from './finding.js';
import type { AtZeroRegistry } from './registry.js';
import { stop } from './stop.js';

/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a reporter that wrote anywhere else would be reporting to nobody. */

function findingsUnder(root: string, registry: AtZeroRegistry): Finding[] {
    const findings: Finding[] = registry.source.flatMap((pass) => pass(root));
    for (const specsRoot of discoverSpecRoots(root)) {
        const prefix = relative(root, specsRoot);
        for (const violation of registry.specs.flatMap((pass) => pass(specsRoot))) {
            findings.push({
                ...violation,
                file: prefix === '' ? violation.file : `${prefix}/${violation.file}`,
            });
        }
    }
    return findings;
}

/** No fixer, no ratchet, no JSON: a repository run this way is held at zero. */
export function runAtZero(registry: AtZeroRegistry, cliArguments: readonly string[]): never {
    const root = resolve(cliArguments[0] ?? '.');
    const findings = findingsUnder(root, registry);
    for (const finding of findings) {
        const lesson = lessonAt(rowNamed(registry.rows, finding.rule), finding, registry.chapter);
        console.error(reportLine(finding, lesson));
    }
    const errors = findings.filter((finding) => finding.severity === 'error').length;
    if (errors > 0) {
        console.error(`\nself checker: ${errors} error(s) found under ${root}`);
        stop(1);
    }
    console.log(`self checker: no error under ${root} (${registry.passIds.join(', ')})`);
    stop(0);
}
