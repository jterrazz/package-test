import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { noUnknownConstructor } from './no-unknown-constructor.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('no-unknown-constructor', noUnknownConstructor as unknown as OxlintRule, {
    invalid: [
        // The removed v8 vocabulary.
        { code: 'await specification.app({});', errors: 1 },
        { code: 'await specification.stack({});', errors: 1 },
        // Non-call member access is flagged too.
        { code: 'const f = specification.http;', errors: 1 },
    ],
    valid: [
        { code: 'await specification.api({ server });' },
        { code: 'await specification.job({ jobs });' },
        { code: 'await specification.cli("./bin");' },
        { code: 'await specification.mobile({ app, device });' },
        // Other objects are untouched.
        { code: 'await other.app({});' },
    ],
});
