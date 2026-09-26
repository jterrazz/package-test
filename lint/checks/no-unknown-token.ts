import { TOKEN_KINDS } from '../../src/expectations/tokens/match.js';
import type { TokenViolation } from './checker.js';
import { findUnknownTokens, LEADING_WORD, VALID_TOKEN } from './tokens.js';

function tokenLesson(token: string): Pick<TokenViolation, 'fix' | 'found' | 'rule'> {
    const inner = token.slice(2, -2);
    if (VALID_TOKEN.test(inner)) {
        return {
            fix: `write one of the tokens the vocabulary has, between double braces: ${[...TOKEN_KINDS].join(', ')}`,
            found: `the unknown token ${token}`,
            rule: 'no-unknown-token',
        };
    }
    const kind = LEADING_WORD.exec(inner)?.groups?.kind ?? '';
    return {
        fix: `write ${kind} bare, or its named capture ${kind}#<name>, between double braces`,
        found: `the malformed token ${token}`,
        rule: 'no-malformed-ref',
    };
}

export function unknownTokenFindings(text: string, file: string, firstLine = 1): TokenViolation[] {
    return findUnknownTokens(text).map(({ line, token }) => {
        const { fix, found, rule } = tokenLesson(token);
        return { file, fix, found, line: firstLine + line - 1, rule, severity: 'error', token };
    });
}
