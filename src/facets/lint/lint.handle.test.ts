import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { oxlintBinary, startLint } from './lint.handle.js';

describe('lint.handle', () => {
    test('startLint — a specification naming no linter — is refused, since it would judge nothing', async () => {
        // Given - no plugin, no config, no checker and no presets
        // Then - the refusal says how to name one, the base preset alone included
        await expect(startLint({})).rejects.toThrow(
            'found: specification.lint() with no plugin, no config, no checker and no presets\nwhy: A lint specification runs the linters it names, and one that names none judges nothing.\nfix: name the plugins, the config, the checkers or the presets the specification lints with — `presets: []` for the base preset alone\nread: docs/21-lint.md#options',
        );
    });

    test('startLint — a plugin no node_modules resolves — is refused before any tree is linted', async () => {
        // Given - a plugin named by a specifier nothing installed answers
        // Then - the refusal names the specifier and where it looked
        await expect(startLint({ plugins: ['@acme/no-such-plugin'] })).rejects.toThrow(
            /^found: plugins: \['@acme\/no-such-plugin'\], which resolves from no node_modules under /u,
        );
    });

    test('oxlintBinary — an anchor no oxlint resolves from — is refused before any tree is linted', () => {
        // Given - an anchor in a folder with no node_modules
        const anchor = join(scratchDirectory('lint-handle-anchor-'), 'package.json');

        // Then - the refusal names the anchor it searched and the peer to install
        expect(() => oxlintBinary([anchor])).toThrow(
            `found: specification.lint() runs oxlint, and none resolves from ${anchor}\nwhy: A plugin and a config are run by the real oxlint, the one a project lints with.\nfix: install oxlint — an optional peer of @jterrazz/test — beside the project\nread: docs/21-lint.md#options`,
        );
    });
});
