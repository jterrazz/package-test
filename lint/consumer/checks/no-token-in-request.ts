import { findKnownTokens } from '../../engine/project/tokens.js';
import type { Spotted } from './checker.js';

export function noTokenInRequestFindings(file: string, text: string): Spotted[] {
    return findKnownTokens(text).map(({ line, token }) => ({
        path: file,
        line,
        fix: 'write the literal value the request sends — a request is sent, never matched',
        found: `the token ${token} in a _requests/ file`,
        rule: 'no-token-in-request',
    }));
}
