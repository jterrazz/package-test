import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { cli } from './cli.project.js';

/** The plugins a project carries, by name — a plugin with no name is not one. */
function pluginNames(project: TestProjectInlineConfiguration): string[] {
    const plugins: unknown[] = Array.isArray(project.plugins) ? project.plugins : [];
    return plugins.flatMap((plugin) =>
        typeof plugin === 'object' && plugin !== null && 'name' in plugin
            ? [String(plugin.name)]
            : [],
    );
}

describe('cli', () => {
    test('cli.project — cli() — the binary, and the documents that specify it — cli() wires the literate door by default', () => {
        // Given - the canonical cli project
        // Then - the plugin that turns a document into a test file is there
        expect(pluginNames(cli())).toContain('jterrazz-test:literate');
    });

    test('cli.project — cli() — the binary, and the documents that specify it — cli({ literate: false }) collects no documents', () => {
        // Given - a repository whose cli facet has no documents
        // Then - the plugin is absent, and nothing else changed
        expect(pluginNames(cli({ literate: false }))).toStrictEqual([]);
        expect(cli({ literate: false }).test?.name).toBe('cli');
    });
});
