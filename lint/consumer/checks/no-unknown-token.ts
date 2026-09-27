import { findUnknownTokens, TOKEN_KINDS } from '../../engine/project/tokens.js';
import type { Spotted } from './checker.js';

export function noUnknownTokenFindings(text: string, file: string, firstLine = 1): Spotted[] {
    return findUnknownTokens(text).map(({ line, token }) => ({
        path: file,
        fix: `write one of the tokens the vocabulary has, between double braces: ${[...TOKEN_KINDS].join(', ')}`,
        found: `the unknown token ${token}`,
        line: firstLine + line - 1,
        rule: 'no-unknown-token',
    }));
}
