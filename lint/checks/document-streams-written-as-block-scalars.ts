import type { SpecFile } from '../../src/facets/cli/documents/spec-document.js';
import { Scalar } from '../../src/kernel/yaml/document.js';
import { finding, isBlock, runMaps, streamScalars } from './document-model.js';
import type { DocumentFinding } from './document-model.js';

export function checkBlockScalars(
    file: SpecFile,
    lineOf: (scalar: Scalar) => number,
): DocumentFinding[] {
    const findings: DocumentFinding[] = [];
    for (const run of runMaps(file)) {
        for (const { key, scalar } of streamScalars(run)) {
            if (isBlock(scalar) || scalar.value === '') {
                continue;
            }
            findings.push(
                finding('document-streams-written-as-block-scalars', lineOf(scalar), {
                    fix: `write ${key} as a block scalar (\`|\` keeps the final newline, \`|-\` drops it) — \`make fix\` re-styles it`,
                    found: `${key} written as a ${scalar.type === Scalar.PLAIN ? 'plain' : 'quoted'} scalar`,
                }),
            );
        }
    }
    return findings;
}
