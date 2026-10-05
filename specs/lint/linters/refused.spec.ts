import { specification } from '@jterrazz/test';
/* oxlint-disable jterrazz/runner-in-specification-file -- negative constructor specs: every specification.lint() call here is refused before it lints anything, so no runner exists to live in a *.specification.ts file */
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const PROJECT = resolve(import.meta.dirname, '../../..');

describe('refused', () => {
    test('a specification naming no linter is refused, since it would judge nothing', async () => {
        // Given - no plugin, no config, no checker and no presets
        // Then - the refusal says how to name one, the base preset alone included
        await expect(specification.lint({})).rejects.toThrow(
            [
                'found: specification.lint() with no plugin, no config, no checker and no presets',
                'why: A lint specification runs the linters it names, and one that names none judges nothing.',
                'fix: name the plugins, the config, the checkers or the presets the specification lints with — `presets: []` for the base preset alone',
                'read: docs/guides/lint-specs.md#options',
            ].join('\n'),
        );
    });

    test('a plugin no node_modules resolves is refused before any tree is linted, naming where it looked', async () => {
        // Given - a plugin named by a specifier nothing installed answers
        // Then - the refusal names the specifier, the project it searched and the two ways to name a plugin
        await expect(specification.lint({ plugins: ['@acme/no-such-plugin'] })).rejects.toThrow(
            [
                `found: plugins: ['@acme/no-such-plugin'], which resolves from no node_modules under ${PROJECT}`,
                'why: A plugin is loaded by the oxlint the specification runs, from the path it resolves to.',
                "fix: install @acme/no-such-plugin, or name the plugin by its path from the specification's folder",
                'read: docs/guides/lint-specs.md#options',
            ].join('\n'),
        );
    });
});
