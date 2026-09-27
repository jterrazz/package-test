import {
    assertedStreams,
    readSpecFile,
    SpecSyntaxError,
} from '../../engine/project/spec-document.js';
import type { Finding } from './checker.js';
import { noMalformedRefFindings } from './no-malformed-ref.js';
import { noUnknownTokenFindings } from './no-unknown-token.js';

/** `document-follows-its-grammar` through the runner's own parser, then `no-unknown-token` and `no-malformed-ref` over the streams only: a `{{token}}` in a description or a command is text, and `stdin:` is never compared. */
export function checkDocumentFollowsItsGrammar(text: string, rel: string): Finding[] {
    let document;
    try {
        document = readSpecFile(text, rel).document;
    } catch (error) {
        if (!(error instanceof SpecSyntaxError)) {
            throw error;
        }
        return [
            {
                file: rel,
                line: error.line,
                fix: 'rewrite the document to its grammar — chapter 20 lists the keys, their order and what each run requires',
                found: error.reason,
                rule: 'document-follows-its-grammar',
            },
        ];
    }

    return assertedStreams(document).flatMap((stream) =>
        noUnknownTokenFindings(stream.text, rel, stream.line).concat(
            noMalformedRefFindings(stream.text, rel, stream.line),
        ),
    );
}
