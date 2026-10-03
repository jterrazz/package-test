import { ruleTester } from '@jterrazz/test';

import { noRunnerAlias } from './no-runner-alias.js';

ruleTester().run('no-runner-alias', noRunnerAlias, {
    invalid: [
        {
            name: 'A renamed handle with a default is renamed all the same.',
            code: 'const { cli: myCli = fallback } = await specification.cli("./bin");',
            errors: [{ column: 8, line: 1, messageId: 'aliased' }],
        },
        {
            name: 'Renamed facet.',
            code: 'const { cli: myCli, cleanup } = await specification.cli("./bin");',
            errors: [{ column: 8, line: 1, messageId: 'aliased' }],
        },
        {
            name: 'Every alias in the pattern is reported.',
            code: 'const { api: a, cleanup: stop } = await specification.api({ server });',
            errors: [
                { column: 8, line: 1, messageId: 'aliased' },
                { column: 16, line: 1, messageId: 'aliased' },
            ],
        },
    ],
    valid: [
        { name: 'A name declared with no value is no record.', code: 'let handle;' },
        {
            name: 'Canonical names.',
            code: 'const { cli, cleanup, docker } = await specification.cli("./bin");',
        },
        {
            name: 'Aliasing an unrelated call is out of scope.',
            code: 'const { a: b } = await other.cli("./bin");',
        },
        {
            name: 'Rest element is fine.',
            code: 'const { cli, ...rest } = await specification.cli("./bin");',
        },
    ],
});
