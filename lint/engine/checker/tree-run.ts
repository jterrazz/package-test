import { lessonAt, rowNamed } from '../catalogue/lesson.js';
import { reportLine } from './finding.js';
import type { Finding } from './finding.js';
import type { CheckerRegistry } from './registry.js';

export function runTree(specsRoot: string, registry: CheckerRegistry): Finding[] {
    return registry.tree.flatMap((pass) => pass(specsRoot));
}

export function checkerMessage(registry: CheckerRegistry, finding: Finding): string {
    return lessonAt(rowNamed(registry.rows, finding.rule), finding, registry.chapter);
}

export function checkerLine(registry: CheckerRegistry, finding: Finding): string {
    return reportLine(finding, checkerMessage(registry, finding));
}
