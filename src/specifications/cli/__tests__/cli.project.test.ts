import { describe, expect, test } from 'vitest';

import { cli } from '../cli.project.js';

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

function sharedOf(project: ReturnType<typeof cli>): unknown[] {
    return [project.test?.isolate, project.test?.setupFiles];
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

    test('cli.project — the shared worker — a named runner shares one module graph per worker only where the documents bind that same runner', () => {
        // Given - the runner named with the door shut, with the door on its default, and with the door bound to another module
        const runner = './specs/cli/cli.specification.ts';

        // Then - the first two run the runner before each file over one graph; the third keeps every file apart, since a document would keep the first file's runner
        expect([
            sharedOf(cli({ literate: false, runner })),
            sharedOf(cli({ runner })),
            sharedOf(cli({ literate: { runner: './specs/cli/run.specification.ts' }, runner })),
        ]).toStrictEqual([
            [false, [runner]],
            [false, [runner]],
            [undefined, undefined],
        ]);
    });
});
