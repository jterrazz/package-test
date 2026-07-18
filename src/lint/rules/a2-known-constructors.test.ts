import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { a2KnownConstructors } from './a2-known-constructors.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('a2-known-constructors', a2KnownConstructors as unknown as OxlintRule, {
    invalid: [
        // The removed v8 vocabulary.
        { code: 'await specification.app({});', errors: 1 },
        { code: 'await specification.stack({});', errors: 1 },
        // Non-call member access is flagged too.
        { code: 'const f = specification.http;', errors: 1 },
    ],
    valid: [
        { code: 'await specification.api({ server });' },
        { code: 'await specification.jobs({ jobs });' },
        { code: 'await specification.cli("./bin");' },
        // Other objects are untouched.
        { code: 'await other.app({});' },
    ],
});
