import { describe, expect, test } from 'vitest';

import { isPackedPackage, packed } from '../packed.js';
import { directory } from '../spec-path.js';

describe('packed', () => {
    test("packed — the package a consumer installs — names the spec's own project, or the directory handed, and nothing else reads as one", () => {
        // Given - the project's own package, one a directory holds, and values that are no packed package
        const own = packed();
        const shipped = packed(directory('./__fixtures__/greeter/'));

        // Then - each carries its path, and only they are packed packages
        expect([own.path, shipped.path]).toStrictEqual([null, './__fixtures__/greeter/']);
        expect(
            [
                own,
                shipped,
                directory('./__fixtures__/greeter/'),
                { path: null },
                null,
                'packed',
            ].map((value) => isPackedPackage(value)),
        ).toStrictEqual([true, true, false, false, false, false]);
    });
});
