import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { runnerInSpecificationFile } from './runner-in-specification-file.js';

ruleTester().run('runner-in-specification-file', runnerInSpecificationFile, {
    invalid: [
        // Constructor call inside a plain spec file.
        {
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            errors: [{ column: 31, line: 1, messageId: 'outsideSpecification' }],
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
        // Any member counts — `runner-in-specification-file` is about the file, `no-unknown-constructor` about the member.
        {
            code: 'await specification.app({});',
            errors: [{ column: 6, line: 1, messageId: 'outsideSpecification' }],
            filename: '/repo/specs/api/_setup/runner.ts',
        },
    ],
    valid: [
        // The sanctioned home.
        {
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            filename: '/repo/specs/cli/cli.specification.ts',
        },
        // Unrelated member call on another object.
        {
            code: 'other.cli("./bin");',
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
    ],
});
