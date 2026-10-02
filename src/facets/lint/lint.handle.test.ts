import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { oxlintBinary } from './lint.handle.js';

describe('lint.handle', () => {
    test('oxlintBinary — an anchor no oxlint resolves from — is refused before any tree is linted', () => {
        // Given - an anchor in a folder with no node_modules
        const anchor = join(scratchDirectory('lint-handle-anchor-'), 'package.json');

        // Then - the refusal names the anchor it searched and the peer to install
        expect(() => oxlintBinary([anchor])).toThrow(
            `found: specification.lint() runs oxlint, and none resolves from ${anchor}\nwhy: A plugin and a config are run by the real oxlint, the one a project lints with.\nfix: install oxlint — an optional peer of @jterrazz/test — beside the project\nread: docs/16-lint.md#options`,
        );
    });
});
