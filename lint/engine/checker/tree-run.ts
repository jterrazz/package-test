import { lessonOf, readAt, rowNamed } from '@jterrazz/typescript/rules';

import { reportLine } from './finding.js';
import type { Finding } from './finding.js';
import type { CheckerRegistry } from './registry.js';

export function runTree(specsRoot: string, registry: CheckerRegistry): Finding[] {
    return registry.tree.flatMap((pass) => pass(specsRoot));
}

export function checkerMessage(registry: CheckerRegistry, finding: Finding): string {
    const row = rowNamed(registry.rows, finding.rule);
    return lessonOf(row, readAt(row, registry.chapter), finding);
}

export function checkerLine(registry: CheckerRegistry, finding: Finding): string {
    return reportLine(finding, checkerMessage(registry, finding));
}
