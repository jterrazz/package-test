import { ruleTester } from '@jterrazz/test';

import { serviceOrStubFromItsSubpath } from '../service-or-stub-from-its-subpath.js';

const SPEC = '/repo/specs/api/api.specification.ts';

ruleTester().run('service-or-stub-from-its-subpath', serviceOrStubFromItsSubpath, {
    invalid: [
        {
            name: 'A service and a stub beside a root name: each moves to its subpath, the root keeps the rest.',
            code: "import { http, postgres, specification } from '@jterrazz/test';",
            errors: [
                { column: 9, line: 1, messageId: 'fromRoot' },
                { column: 15, line: 1, messageId: 'fromRoot' },
            ],
            filename: SPEC,
            output: "import { specification } from '@jterrazz/test';\nimport { postgres } from '@jterrazz/test/services';\nimport { http } from '@jterrazz/test/stubs';",
        },
        {
            name: 'A default import stays at the root, beside the names that do, and each message names the name and its subpath.',
            code: "import app, { file, postgres } from '@jterrazz/test';",
            errors: [
                {
                    column: 20,
                    line: 1,
                    message:
                        /^found: `postgres` is imported from the root, `@jterrazz\/test` · why: .* · fix: import it from `@jterrazz\/test\/services`; `typescript fix` moves the import · read: /u,
                },
            ],
            filename: SPEC,
            output: "import app, { file } from '@jterrazz/test';\nimport { postgres } from '@jterrazz/test/services';",
        },
        {
            name: 'A default import alone at the root keeps no braces.',
            code: "import app, { http } from '@jterrazz/test';",
            errors: [{ column: 14, line: 1, messageId: 'fromRoot' }],
            filename: SPEC,
            output: "import app from '@jterrazz/test';\nimport { http } from '@jterrazz/test/stubs';",
        },
        {
            name: 'An import naming services alone leaves no root import behind.',
            code: "import { postgres, redis } from '@jterrazz/test';",
            errors: [
                { column: 9, line: 1, messageId: 'fromRoot' },
                { column: 19, line: 1, messageId: 'fromRoot' },
            ],
            filename: SPEC,
            output: "import { postgres, redis } from '@jterrazz/test/services';",
        },
        {
            name: 'A type-only import stays type-only, and an inline `type` and an alias are kept as written.',
            code: 'import type { ServiceHandle, Stub as Reply } from "@jterrazz/test";\nimport { type DiskFile, type SeedSource, sqlite as db } from "@jterrazz/test";',
            errors: [
                { column: 14, line: 1, messageId: 'fromRoot' },
                { column: 29, line: 1, messageId: 'fromRoot' },
                { column: 24, line: 2, messageId: 'fromRoot' },
                { column: 41, line: 2, messageId: 'fromRoot' },
            ],
            filename: SPEC,
            output: 'import type { ServiceHandle } from "@jterrazz/test/services";\nimport type { Stub as Reply } from "@jterrazz/test/stubs";\nimport { type DiskFile } from "@jterrazz/test";\nimport { type SeedSource, sqlite as db } from "@jterrazz/test/services";',
        },
        {
            name: 'A re-export moves as an import does.',
            code: "export { defineStub, file } from '@jterrazz/test';",
            errors: [{ column: 9, line: 1, messageId: 'fromRoot' }],
            filename: SPEC,
            output: "export { file } from '@jterrazz/test';\nexport { defineStub } from '@jterrazz/test/stubs';",
        },
        {
            name: 'A member of a namespace import of the root is reported, and left to its reader.',
            code: "import * as t from '@jterrazz/test';\nexport const db = t.postgres();\nexport const at = t.file('./x');",
            errors: [
                {
                    column: 18,
                    line: 2,
                    message:
                        /^found: `t\.postgres` reaches a name the root no longer publishes · why: .* · fix: import `postgres` from `@jterrazz\/test\/services` by name: `import \{ postgres \} from '@jterrazz\/test\/services'` · read: /u,
                },
            ],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: 'The subpaths themselves, and the root for what writes a spec.',
            code: "import { file, specification } from '@jterrazz/test';\nimport { postgres } from '@jterrazz/test/services';\nimport { http } from '@jterrazz/test/stubs';",
            filename: SPEC,
        },
        {
            name: 'A name the framework does not publish at a subpath is no business of the rule, from any package.',
            code: "import { http } from 'msw';\nimport { process } from './runtime.js';",
            filename: SPEC,
        },
        {
            name: 'A namespace of another package, and a computed member of the root, are no business of the rule.',
            code: "import * as t from 'msw';\nimport * as root from '@jterrazz/test';\nexport const db = t.postgres;\nexport const other = root['postgres'];",
            filename: SPEC,
        },
        {
            name: 'A namespace import reaching only root names.',
            code: "import * as t from '@jterrazz/test';\nexport const at = t.file('./x');\nexport const other = u.postgres;",
            filename: SPEC,
        },
    ],
});
