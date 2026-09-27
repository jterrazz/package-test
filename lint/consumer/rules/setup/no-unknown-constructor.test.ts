import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { noUnknownConstructor } from './no-unknown-constructor.js';

ruleTester().run('no-unknown-constructor', noUnknownConstructor, {
    invalid: [
        // The removed v8 vocabulary.
        {
            code: 'await specification.app({});',
            errors: [{ column: 6, line: 1, messageId: 'unknownConstructor' }],
        },
        {
            code: 'await specification.stack({});',
            errors: [{ column: 6, line: 1, messageId: 'unknownConstructor' }],
        },
        // Non-call member access is flagged too.
        {
            code: 'const f = specification.http;',
            errors: [{ column: 10, line: 1, messageId: 'unknownConstructor' }],
        },
    ],
    valid: [
        { code: 'await specification.api({ server });' },
        { code: 'await specification.job({ jobs });' },
        { code: 'await specification.cli("./bin");' },
        { code: 'await specification.integration({ services });' },
        { code: 'await specification.website({ server });' },
        { code: 'await specification.mobile({ app, device });' },
        { code: 'await specification.lint({ presets: [] });' },
        // Other objects are untouched.
        { code: 'await other.app({});' },
    ],
});
