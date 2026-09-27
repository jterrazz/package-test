import { describe, expect, test } from 'vitest';

import { startLint } from './lint.handle.js';

describe('startLint', () => {
    test('startLint — a specification naming no linter — is refused, since it would judge nothing', async () => {
        // Given - no plugin, no checker and no presets
        // Then - the refusal says how to name one, the base preset alone included
        await expect(startLint({})).rejects.toThrow(
            'found: specification.lint() with no plugin, no checker and no presets\nwhy: A lint specification runs the linters it names, and one that names none judges nothing.\nfix: name the plugins, the checkers or the presets the specification lints with — `presets: []` for the base preset alone\nread: docs/21-lint.md#options',
        );
    });

    test('startLint — a plugin no node_modules resolves — is refused before any tree is linted', async () => {
        // Given - a plugin named by a specifier nothing installed answers
        // Then - the refusal names the specifier and where it looked
        await expect(startLint({ plugins: ['@acme/no-such-plugin'] })).rejects.toThrow(
            /^found: plugins: \['@acme\/no-such-plugin'\], which resolves from no node_modules under /u,
        );
    });
});
