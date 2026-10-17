import { finding, fixedData } from '../../kit/project/document-model.js';
import { assertedStreams } from '../../kit/project/spec-document.js';
import type { SpecDocument } from '../../kit/project/spec-grammar.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import type { DocumentFinding } from './checker.js';

const ISO8601 = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/u;

const UUID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/u;

export function checkPinnedValueFromTheInput(
    document: SpecDocument,
    dir: string,
    source: string,
): DocumentFinding[] {
    const findings: DocumentFinding[] = [];
    let fixed: null | string = null;
    // invariant: no comment can stand inside a block scalar, so a directive above a stream's key (the line before its content) silences the stream.
    const silenced = suppressedLines(source, 'pinned-value-from-the-input');
    const streams = assertedStreams(document).filter(
        (stream) => !silenced.has(stream.line) && !silenced.has(stream.line - 1),
    );
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
