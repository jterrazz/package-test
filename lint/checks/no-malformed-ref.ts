import type { Finding } from './checker.js';
import { findMalformedRefs } from './tokens.js';

const KIND = /^\{\{(?<kind>[A-Za-z][A-Za-z0-9]*)/u;

export function malformedRefFindings(text: string, file: string, firstLine = 1): Finding[] {
    return findMalformedRefs(text).map(({ line, token }) => {
        const kind = KIND.exec(token)?.groups?.kind ?? '';
        return {
            file,
            fix: `write ${kind} bare, or its named capture ${kind}#<name>, between double braces`,
            found: `the malformed token ${token}`,
            line: firstLine + line - 1,
            rule: 'no-malformed-ref',
            severity: 'error',
            token,
        };
    });
}
