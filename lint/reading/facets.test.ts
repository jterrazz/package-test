import { describe, expect, test } from 'vitest';

import { reachesRunner } from './facets.js';

describe('facets', () => {
    test('reachesRunner — a test reaches its runner through the package, a specification module, or a constructor call', () => {
        // Given - one test per way in, the extensionless specification import among them
        const ways = [
            "import { file } from '@jterrazz/test';",
            "import { cli } from '../cli.specification';",
            'const broken = specification.api({ root: 42 });',
        ];

        // Then - each counts
        expect(ways.map((text) => reachesRunner(text))).toStrictEqual([true, true, true]);
    });

    test('reachesRunner — a test importing neither reaches no runner', () => {
        // Given - a module test of a plain module, whose name only mentions a specification
        const text = "import { specificationName } from './naming.js';\n";

        // Then - it reaches none
        expect(reachesRunner(text)).toBe(false);
    });
});
