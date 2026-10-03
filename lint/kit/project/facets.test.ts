import { describe, expect, test } from 'vitest';

import { reachesRunner } from './facets.js';

describe('facets', () => {
    test('reachesRunner — a test reaches its runner through the package, a specification module, or a constructor call', () => {
        // Given - one test per way in, the extensionless specification import among them
        const ways = [
            "import { file } from '@jterrazz/test';",
            "import { matchers } from '@jterrazz/test/matchers';",
            "import { cli } from '../cli.specification';",
            'const broken = specification.api({ root: 42 });',
        ];

        // Then - each counts
        expect(ways.map((text) => reachesRunner(text))).toStrictEqual([true, true, true, true]);
    });

    test('reachesRunner — a test importing neither reaches no runner', () => {
        // Given - a module test of plain modules, one only naming a specification, one under a folder that does, one of a package whose name begins like the runner's
        const text = [
            "import { specificationName } from './naming.js';",
            "import { helper } from './api.specification-helpers/helper.js';",
            "import { other } from '@jterrazz/testing';",
            '',
        ].join('\n');

        // Then - it reaches none
        expect(reachesRunner(text)).toBe(false);
    });
});
