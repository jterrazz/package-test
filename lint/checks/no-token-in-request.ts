import type { TokenViolation } from './checker.js';
import { findKnownTokens } from './tokens.js';

export function tokenInRequestFindings(file: string, text: string): TokenViolation[] {
    return findKnownTokens(text).map(({ line, token }) => ({
        file,
        line,
        fix: 'write the literal value the request sends — a request is sent, never matched',
        found: `the token ${token} in a requests/ file`,
        rule: 'no-token-in-request',
        severity: 'warn',
        token,
    }));
}
