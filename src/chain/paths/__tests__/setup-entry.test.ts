import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../scratch.js';
import { setupEntry } from '../setup-entry.js';

describe('setupEntry', () => {
    test('a source checkout — the setup is its .ts, beside its owner', () => {
        // Given - a folder holding the setup's source
        const directory = scratchDirectory('setup-source-');
        writeFileSync(join(directory, 'services.global-setup.ts'), '');

        // Then - the source is what the runner loads
        expect(setupEntry(directory, 'services')).toBe(join(directory, 'services.global-setup.ts'));
    });

    test('the built package — no source beside it — the setup is the entry the build names after it', () => {
        // Given - the bundle's folder, where no .ts ships
        const directory = scratchDirectory('setup-bundle-');

        // Then - the entry the bundle built for it, in the same folder
        expect(setupEntry(directory, 'temp-root')).toBe(
            join(directory, 'temp-root.global-setup.js'),
        );
    });
});
