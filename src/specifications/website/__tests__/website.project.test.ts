import { describe, expect, test } from 'vitest';

import { website } from '../website.project.js';

describe('website', () => {
    test('website.project — the vitest project of the specification — is named for it, and runs after the node projects', () => {
        // Given - the specification's project
        const project = website();

        // Then - it is named for it, and runs after the node projects
        expect([project.test?.name, project.test?.sequence?.groupOrder]).toStrictEqual([
            'website',
            1,
        ]);
    });

    test('website.project — the shared worker — a named runner runs before each file over one module graph per worker', () => {
        // Given - the project with its runner named, and without
        const named = website({ runner: './specs/website/website.specification.ts' });
        const unnamed = website();

        // Then - the named one shares the worker, and the other isolates each file
        expect([
            [named.test?.isolate, named.test?.setupFiles],
            [unnamed.test?.isolate, unnamed.test?.setupFiles],
        ]).toStrictEqual([
            [false, ['./specs/website/website.specification.ts']],
            [undefined, undefined],
        ]);
    });
});
