import { describe, expect, test } from 'vitest';

import { checkDocumentFollowsItsGrammar } from './document-follows-its-grammar.js';

describe('checkDocumentFollowsItsGrammar', () => {
    test('a document its grammar refuses is found where the reader refused it, and a valid one has its streams read for tokens', () => {
        // Given - a refused document, and a valid one whose stdout holds an unknown token on its second line
        const refused = 'description: x\nruns:\n  - command: a\n';
        const valid = [
            'description: x',
            'runs:',
            '  - command: a',
            '    exit: 0',
            '    stdout: |',
            '      fine',
            '      {{nope}}',
            '',
        ].join('\n');

        // Then - the refusal at its line, then the token at the line of the stream it sits on
        expect(
            [refused, valid].flatMap((text) =>
                checkDocumentFollowsItsGrammar(text, 'case.spec.yaml').map(
                    ({ fix, found, line, rule }) => `${rule} ${line} ${found} — ${fix}`,
                ),
            ),
        ).toStrictEqual([
            'document-follows-its-grammar 3 a run is missing "exit:" — command and exit are mandatory — rewrite the document to its grammar — chapter 15 lists the keys, their order and what each run requires',
            'no-unknown-token 7 the unknown token {{nope}} — write one of the tokens the vocabulary has, between double braces: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir',
        ]);
    });
});
