import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('fix-moves', () => {
    test("--fix moves the seed one leaf's two tests share into its _seeds/ and removes the emptied folder", async () => {
        // Given - the lonely-seed tree
        const result = await checker
            .fixture(directory('./_fixtures/lonely-seed/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/_shared/_seeds/one-user.sql').exists).toBe(false);
        expect(result.file('specs/_shared/_seeds').exists).toBe(false);
        expect(result.file('specs/api/users/_seeds/one-user.sql').exists).toBe(true);
        expect(result.file('specs/api/users/listed.spec.ts').content).toContain(
            "file('./_seeds/one-user.sql')",
        );
    });

    test("--fix moves the seed a route and its sub-route share into the route's _seeds/, both reaching it", async () => {
        // Given - the nested-route tree
        const result = await checker
            .fixture(directory('./_fixtures/nested-route/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/_shared').exists).toBe(false);
        expect(result.file('specs/api/map/pois/_seeds/single-base.sql').exists).toBe(true);
        expect(result.file('specs/api/map/pois/listing.spec.ts').content).toContain(
            "file('./_seeds/single-base.sql')",
        );
        expect(result.file('specs/api/map/pois/detail/listing.spec.ts').content).toContain(
            "file('../_seeds/single-base.sql')",
        );
    });

    test('--fix moves the seed two sibling routes share into the _seeds/ of their folder, both reaching it', async () => {
        // Given - the sibling-routes tree
        const result = await checker
            .fixture(directory('./_fixtures/sibling-routes/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/_shared').exists).toBe(false);
        expect(result.file('specs/api/map/_seeds/two-pois.sql').exists).toBe(true);
        expect(result.file('specs/api/map/pois/listing.spec.ts').content).toContain(
            "file('../_seeds/two-pois.sql')",
        );
        expect(result.file('specs/api/map/areas/listing.spec.ts').content).toContain(
            "file('../_seeds/two-pois.sql')",
        );
    });

    test("--fix moves a pool fixture one facet's runner alone reads into that facet's _fixtures/", async () => {
        // Given - the runner-read tree
        const result = await checker
            .fixture(directory('./_fixtures/runner-read/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/_shared').exists).toBe(false);
        expect(result.file('specs/cli/_fixtures/shop/cli.sh').exists).toBe(true);
        expect(result.file('specs/cli/cli.specification.ts').content).toContain(
            "resolve(import.meta.dirname, './_fixtures/shop/cli.sh')",
        );
    });

    test('--fix moves the lonely pool fixture beside its leaf, repoints it and removes the emptied pool', async () => {
        // Given - the lonely tree
        const result = await checker.fixture(directory('./_fixtures/lonely/')).run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/_shared/_fixtures/lonely-stub/main.js').exists).toBe(false);
        expect(result.file('specs/_shared/_fixtures').exists).toBe(false);
        expect(result.file('specs/widget/_fixtures/lonely-stub/main.js').exists).toBe(true);
        expect(result.file('specs/widget/widget.test.ts').content).toContain(
            './_fixtures/lonely-stub/',
        );
    });
});
