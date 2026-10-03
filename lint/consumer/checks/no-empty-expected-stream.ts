import { finding } from '../../kit/project/document-model.js';
import { assertedStreams } from '../../kit/project/spec-document.js';
import type { SpecDocument } from '../../kit/project/spec-grammar.js';
import type { DocumentFinding } from './checker.js';

const ANY = '{{any}}';

export function checkNoEmptyExpectedStream(document: SpecDocument): DocumentFinding[] {
    return assertedStreams(document)
        .filter(({ text }) => text.includes(ANY) && text.replaceAll(ANY, '').trim() === '')
        .map(({ line }) =>
            finding('no-empty-expected-stream', line, {
                fix: 'write what the command actually printed, tokens for what moves',
                found: 'a stream that is only {{any}}',
            }),
        );
}
