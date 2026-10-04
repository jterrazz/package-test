import { assertedStreams, readSpecFile } from '../../kit/project/spec-document.js';
import { SpecSyntaxError } from '../../kit/project/spec-grammar.js';
import type { Spotted } from './checker.js';
import { noMalformedRefFindings } from './no-malformed-ref.js';
import { noUnknownTokenFindings } from './no-unknown-token.js';

/** `document-follows-its-grammar` through the runner's own parser, then `no-unknown-token` and `no-malformed-ref` over the streams only: a `{{token}}` in a description or a command is text, and `stdin:` is never compared. */
export function checkDocumentFollowsItsGrammar(text: string, rel: string): Spotted[] {
    let document;
    try {
        ({ document } = readSpecFile(text, rel));
    } catch (error) {
        // Stryker disable next-line ConditionalExpression,BlockStatement: only a bug of the reader throws anything else
        if (!(error instanceof SpecSyntaxError)) {
            throw error;
        }
        return [
            {
                path: rel,
                line: error.line,
                fix: 'rewrite the document to its grammar — the Spec documents page lists the keys, their order and what each run requires',
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
