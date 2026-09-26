import { TOKEN_KINDS } from '../../src/expectations/tokens/match.js';
import type { Finding } from './checker.js';
import { findUnknownTokens } from './tokens.js';

export function unknownTokenFindings(text: string, file: string, firstLine = 1): Finding[] {
    return findUnknownTokens(text).map(({ line, token }) => ({
        file,
        fix: `write one of the tokens the vocabulary has, between double braces: ${[...TOKEN_KINDS].join(', ')}`,
        found: `the unknown token ${token}`,
        line: firstLine + line - 1,
        rule: 'no-unknown-token',
        severity: 'error',
        token,
    }));
}
