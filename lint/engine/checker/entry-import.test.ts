import { describe, expect, test } from 'vitest';

import { importsFromEntry, withEntryImport, withoutEntryImport } from './entry-import.js';

const SPEC = 'specs/api/users.spec.ts';

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
});
