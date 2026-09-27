import { finding, fixedData } from '../../engine/project/document-model.js';
import { assertedStreams } from '../../engine/project/spec-document.js';
import type { SpecDocument } from '../../engine/project/spec-document.js';
import type { DocumentFinding } from './checker.js';

const ISO8601 = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/u;

const UUID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/u;

export function checkPinnedValueFromTheInput(
    document: SpecDocument,
    dir: string,
): DocumentFinding[] {
    const findings: DocumentFinding[] = [];
    const streams = assertedStreams(document);
    if (streams.length === 0) {
        return findings;
    }
    let fixed: null | string = null;
    for (const stream of streams) {
        for (const [index, text] of stream.text.split('\n').entries()) {
            for (const [pattern, token] of [
                [ISO8601, '{{iso8601}}'],
                [UUID, '{{uuid}}'],
            ] as const) {
                const found = pattern.exec(text);
                if (found === null) {
                    continue;
                }
                fixed ??= fixedData(document, dir);
                if (fixed.includes(found[0])) {
                    continue;
                }
                findings.push(
                    finding('pinned-value-from-the-input', stream.line + index, {
                        fix: `write ${token} where "${found[0]}" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document`,
                        found: `"${found[0]}", which no \`fixture:\` or \`stdin:\` of this document pins`,
                    }),
                );
            }
        }
    }
    return findings;
}
