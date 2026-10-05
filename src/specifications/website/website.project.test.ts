import { describe, expect, test } from 'vitest';

import { website } from './website.project.js';

describe('website', () => {
    test('website.project — the vitest project of the specification — is named for it, and runs after the node projects', () => {
        // Given - the specification’s project
        const project = website();

        // Then - it is named for it, and runs after the node projects
        expect([project.test?.name, project.test?.sequence?.groupOrder]).toStrictEqual([
            'website',
            1,
        ]);
    });
});
