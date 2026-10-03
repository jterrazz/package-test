import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../testing/package-tree.fixtures.js';
import {
    entryFor,
    importsFromEntry,
    withEntryImport,
    withImport,
    withoutEntryImport,
} from './entry-import.js';

const SPEC = 'specs/api/users.spec.ts';

const runner = (from: string): string =>
    `import { other } from '@x/y.specification.js';\nimport { a } from './a.js';\nimport { api } from '${from}';\n`;

describe('entry-import', () => {
    test('withEntryImport — merges a name into the entry import the file already holds', () => {
        // Given - a spec importing one name from the package entry
        const text = "import { directory } from '@jterrazz/test';\n\ndirectory('x');\n";

        // Then - the second name joins it, sorted
        expect(withEntryImport(text, SPEC, 'file')).toBe(
            "import { directory, file } from '@jterrazz/test';\n\ndirectory('x');\n",
        );
    });

    test('withEntryImport — adds the entry import before the first relative one', () => {
        // Given - a spec importing only its facet's runner
        const text = "import { api } from '../api.specification.js';\n\napi.get('/');\n";

        // Then - the package import opens the block, a blank line before the relative one
        expect(withEntryImport(text, SPEC, 'file')).toBe(
            "import { file } from '@jterrazz/test';\n\nimport { api } from '../api.specification.js';\n\napi.get('/');\n",
        );
    });

    test('importsFromEntry and withoutEntryImport — read and drop one name, and the line when it empties', () => {
        // Given - an entry import of two names
        const text = "import { file, sql } from '@jterrazz/test';\nfile('x');\n";

        // Then - one name leaves, then the last takes the line with it
        expect(importsFromEntry(text, 'sql')).toBe(true);
        const kept = withoutEntryImport(text, 'sql');
        expect(kept).toBe("import { file } from '@jterrazz/test';\nfile('x');\n");
        expect(importsFromEntry(kept, 'sql')).toBe(false);
        expect(withoutEntryImport(kept, 'file')).toBe("file('x');\n");
    });

    test('entryFor — names the entry the spec reaches through its specification, from the spec', () => {
        // Given - specifications importing the package, the source entry, or neither, and specs importing them every way
        const root = packageWith({
            'specs/api/api.specification.ts':
                "import { specification } from '../../src/index.js';\n",
            'specs/cli/cli.specification.ts': "import { specification } from '@jterrazz/test';\n",
            'specs/web/home/a.ts': "import { x } from '../../../other/src/index.js';\n",
            'specs/web/web.specification.ts': "import { page } from './page.js';\n",
        });
        const at = (path: string): string => join(root, path);

        // Then - the entry each one reaches, or the package when none is found
        expect([
            entryFor(runner('../api.specification.js'), at('specs/api/users/list.spec.ts')),
            entryFor(runner('../cli.specification.ts'), at('specs/cli/run/a.spec.ts')),
            entryFor(runner('../web.specification.js'), at('specs/web/home/a.spec.ts')),
            entryFor(runner('../gone.specification.js'), at('specs/api/users/list.spec.ts')),
        ]).toStrictEqual([
            '../../../src/index.js',
            '@jterrazz/test',
            '@jterrazz/test',
            '@jterrazz/test',
        ]);
    });

    test('withEntryImport — merges into the entry import sorted as read, case aside, in its own quotes', () => {
        // Given - an entry import in double quotes, spelled out of order, with a trailing comma
        const text = 'import { Zeta, aa, } from "@jterrazz/test";\n';

        // Then - the names sorted case-insensitively, the underscore before the letter
        expect(withEntryImport(text, SPEC, 'a_b')).toBe(
            'import { a_b, aa, Zeta } from "@jterrazz/test";\n',
        );
    });

    test('withImport — places a package import before the relative ones, and a relative entry after every import', () => {
        // Given - files with package and relative imports, with no blank line between them, opening on a blank line, or with none at all
        const both = "import { x } from 'x';\nimport { api } from '../api.js';\n";
        const three = `${both}import { b } from './b.js';\n`;
        const spaced = "import { x } from 'x';\n\nimport { api } from '../api.js';\n";
        const opening = "\nimport { api } from '../api.js';\n";
        const line = "import { file } from '@jterrazz/test';";

        // Then - each lands where an author would put it
        expect([
            withImport(both, line, '@jterrazz/test'),
            withImport(spaced, line, '@jterrazz/test'),
            withImport(three, "import { file } from '../src/index.js';", '../src/index.js'),
            withImport(opening, line, '@jterrazz/test'),
            withImport('run();\n', line, '@jterrazz/test'),
        ]).toStrictEqual([
            `import { x } from 'x';\n${line}\nimport { api } from '../api.js';\n`,
            `import { x } from 'x';\n${line}\n\nimport { api } from '../api.js';\n`,
            "import { x } from 'x';\nimport { api } from '../api.js';\nimport { b } from './b.js';\nimport { file } from '../src/index.js';\n",
            `\n${line}\n\nimport { api } from '../api.js';\n`,
            `${line}\nrun();\n`,
        ]);
    });

    test('importsFromEntry and withoutEntryImport — read only the entry, its source one or the package', () => {
        // Given - the name imported from another module, from the source entry in double quotes, and from paths that are no entry
        const text = [
            "import { file } from './file.js';",
            'import { file, sql } from "../src/index.js";',
            "import { other } from 'mysrc/index.js';",
            "import { more } from 'src/index.json';",
            '',
        ].join('\n');

        // Then - the entry's is the one read and dropped, in its quotes
        expect([
            importsFromEntry(text, 'file'),
            importsFromEntry(text, 'other'),
            importsFromEntry(text, 'more'),
            withoutEntryImport(text, 'file'),
            withoutEntryImport(text, 'other'),
            importsFromEntry("import { file } from 'src/index.js';\n", 'file'),
        ]).toStrictEqual([
            true,
            false,
            false,
            text.replace(
                'import { file, sql } from "../src/index.js";',
                'import { sql } from "../src/index.js";',
            ),
            text,
            true,
        ]);
    });
});
