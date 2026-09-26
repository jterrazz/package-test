import { finding } from '../../engine/project/document-model.js';
import { assertedStreams } from '../../engine/project/spec-document.js';
import type { SpecDocument } from '../../engine/project/spec-document.js';
import type { DocumentFinding } from './checker.js';

export function checkNoEmptyExpectedStream(document: SpecDocument): DocumentFinding[] {
    const findings: DocumentFinding[] = [];
    for (const stream of assertedStreams(document)) {
        if (
            stream.text.replaceAll('{{any}}', '').trim() === '' &&
            stream.text.includes('{{any}}')
        ) {
            findings.push(
                finding(
                    'no-empty-expected-stream',
                    stream.line,
                    {
                        fix: 'write what the command actually printed, tokens for what moves',
                        found: 'a stream that is only {{any}}',
                    },
                    'warn',
                ),
            );
        }
    }
    return findings;
}
