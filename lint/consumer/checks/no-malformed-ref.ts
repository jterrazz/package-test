import { findMalformedRefs } from '../../kit/project/tokens.js';
import type { Spotted } from './checker.js';

const KIND = /^\{\{(?<kind>[A-Za-z][A-Za-z0-9]*)/u;

export function noMalformedRefFindings(text: string, file: string, firstLine = 1): Spotted[] {
    return findMalformedRefs(text).map(({ line, token }) => {
        const kind = KIND.exec(token)?.groups?.kind ?? '';
        return {
            path: file,
            fix: `write ${kind} bare, or its named capture ${kind}#<name>, between double braces`,
            found: `the malformed token ${token}`,
            line: firstLine + line - 1,
            rule: 'no-malformed-ref',
        };
    });
}
