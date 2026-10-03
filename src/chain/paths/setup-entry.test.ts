import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from './scratch.js';
import { setupEntry } from './setup-entry.js';

describe('setupEntry', () => {
    test('a source checkout — the setup is its .ts, beside its owner', () => {
        // Given - a folder holding the setup's source
        const directory = scratchDirectory('setup-source-');
        writeFileSync(join(directory, 'run-setup.ts'), '');

        // Then - the source is what the runner loads
        expect(setupEntry(directory, 'run-setup', 'services-setup')).toBe(
            join(directory, 'run-setup.ts'),
        );
    });

    test('the built package — no source beside it — the setup is its bundled entry, named by its stem unless the bundle names it otherwise', () => {
        // Given - the bundle's folder, where no .ts ships
        const directory = scratchDirectory('setup-bundle-');

        // Then - the entry the bundle built for it, in the same folder
        expect([
            setupEntry(directory, 'run-setup', 'services-setup'),
            setupEntry(directory, 'temp-root'),
        ]).toStrictEqual([join(directory, 'services-setup.js'), join(directory, 'temp-root.js')]);
    });
});
