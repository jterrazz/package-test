import { describe, expect, test } from 'vitest';

import { cli } from '../cli.project.js';

/** The include each documents plugin of a project adds, and how many there are. */
function documentsOf(project: ReturnType<typeof cli>): unknown[] {
    return (project.plugins ?? []).flat().map((plugin) => {
        const config: unknown =
            typeof plugin === 'object' &&
            plugin !== null &&
            'config' in plugin &&
            typeof plugin.config === 'function'
                ? Reflect.apply(plugin.config, plugin, [])
                : undefined;
        return config;
    });
}

describe('cli', () => {
    test('cli.project — the documents door — collects the cli documents by default, a stated glob instead, and none when shut', () => {
        // Given - a default project, one stating its documents, and one shutting the door
        // Then - the include each documents plugin adds
        expect([
            documentsOf(cli()),
            documentsOf(cli({ literate: { include: ['docs/**/*.spec.yaml'] } })),
            documentsOf(cli({ literate: false })),
        ]).toStrictEqual([
            [{ test: { include: ['specs/cli/**/*.spec.yaml'] } }],
            [{ test: { include: ['docs/**/*.spec.yaml'] } }],
            [],
        ]);
    });
});
