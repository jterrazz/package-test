import { assertedStreams } from '../../src/facets/cli/documents/spec-document.js';
import type { SpecDocument } from '../../src/facets/cli/documents/spec-document.js';
import { finding } from './document-model.js';
import type { Finding } from './document-model.js';

export function checkEmptyAssertions(document: SpecDocument): Finding[] {
    const findings: Finding[] = [];
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
