import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('fix-moves', () => {
    test("--fix moves the seed one leaf's two tests share into its __seeds__/ and removes the emptied folder", async () => {
        // Given - the lonely-seed tree
        const result = await checker
            .fixture(directory('./__fixtures__/lonely-seed/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/__seeds__/one-user.sql').exists).toBe(false);
        expect(result.file('specs/__seeds__').exists).toBe(false);
        expect(result.file('specs/api/users/__seeds__/one-user.sql').exists).toBe(true);
        expect(result.file('specs/api/users/listed.spec.ts').content).toContain(
            "file('./__seeds__/one-user.sql')",
        );
    });

    test("--fix moves the seed a route and its sub-route share into the route's __seeds__/, both reaching it", async () => {
        // Given - the nested-route tree
        const result = await checker
            .fixture(directory('./__fixtures__/nested-route/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/__seeds__').exists).toBe(false);
        expect(result.file('specs/api/map/pois/__seeds__/single-base.sql').exists).toBe(true);
        expect(result.file('specs/api/map/pois/listing.spec.ts').content).toContain(
            "file('./__seeds__/single-base.sql')",
        );
        expect(result.file('specs/api/map/pois/detail/listing.spec.ts').content).toContain(
            "file('../__seeds__/single-base.sql')",
        );
    });

    test('--fix moves the seed two sibling routes share into the __seeds__/ of their folder, both reaching it', async () => {
        // Given - the sibling-routes tree
        const result = await checker
            .fixture(directory('./__fixtures__/sibling-routes/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/__seeds__').exists).toBe(false);
        expect(result.file('specs/api/map/__seeds__/two-pois.sql').exists).toBe(true);
        expect(result.file('specs/api/map/pois/listing.spec.ts').content).toContain(
            "file('../__seeds__/two-pois.sql')",
        );
        expect(result.file('specs/api/map/areas/listing.spec.ts').content).toContain(
            "file('../__seeds__/two-pois.sql')",
        );
    });

    test("--fix moves a pool fixture one specification's runner alone reads into that specification's __fixtures__/", async () => {
        // Given - the runner-read tree
        const result = await checker
            .fixture(directory('./__fixtures__/runner-read/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/__fixtures__').exists).toBe(false);
        expect(result.file('specs/cli/__fixtures__/shop/cli.sh').exists).toBe(true);
        expect(result.file('specs/cli/cli.specification.ts').content).toContain(
            "resolve(import.meta.dirname, './__fixtures__/shop/cli.sh')",
        );
    });

    test('--fix moves the lonely pool fixture beside its leaf, repoints it and removes the emptied pool', async () => {
        // Given - the lonely tree
        const result = await checker
            .fixture(directory('./__fixtures__/lonely/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/__fixtures__/lonely-stub/main.js').exists).toBe(false);
        expect(result.file('specs/__fixtures__').exists).toBe(false);
        expect(result.file('specs/widget/__fixtures__/lonely-stub/main.js').exists).toBe(true);
        expect(result.file('specs/widget/widget.test.ts').content).toContain(
            './__fixtures__/lonely-stub/',
        );
    });
});
