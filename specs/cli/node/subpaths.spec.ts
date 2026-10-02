import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('subpaths', () => {
    test('every target the exports map publishes is in the install, and loads under its condition', async () => {
        // Given - a consumer's project with the tarball installed
        const result = await cli
            .fixture(directory('./_fixtures/consumer/'))
            .exec('node subpaths.mjs');

        // Then - each subpath answers every condition it declares: node loads its builds, a page's build finds every package it imports
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            @jterrazz/test (types) → ./dist/index.d.ts: held
            @jterrazz/test (browser) → ./dist/browser/index.js: imports vitest, vitest-mock-extended, vitest/browser, each resolved
            @jterrazz/test (import) → ./dist/index.js: loads, 49 names
            @jterrazz/test/vitest (types) → ./dist/vitest.d.ts: held
            @jterrazz/test/vitest (import) → ./dist/vitest.js: loads, 11 names
            @jterrazz/test/config (types) → ./dist/config.d.ts: held
            @jterrazz/test/config (import) → ./dist/config.js: loads, 1 names
            @jterrazz/test/oxlint (types) → ./dist/oxlint.d.ts: held
            @jterrazz/test/oxlint (import) → ./dist/oxlint.js: loads, 4 names
            @jterrazz/test/oxlint (types) → ./dist/oxlint.d.cts: held
            @jterrazz/test/oxlint (require) → ./dist/oxlint.cjs: loads, 4 names
            @jterrazz/test/schema (default) → ./schema/spec.schema.json: loads, 9 names
        `);
    });

    test('the node entry loads no library a spec pays for only when it declares one', async () => {
        // Given - a consumer's project importing the node entry into a fresh module graph
        const result = await cli.fixture(directory('./_fixtures/consumer/')).exec('node eager.mjs');

        // Then - the network double's library, the browser and the device driver stay behind their adapters' lazy imports
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            @jterrazz/typescript
            chai
            expect-type
            tinybench
            vite
            vitest
            vitest-mock-extended
            yaml
        `);
    });

    test('the oxlint entry answers what test material is alike from its ESM and its CommonJS build', async () => {
        // Given - a consumer's project asking both builds the questions its `no-test-code-in-production` guard asks
        const result = await cli
            .fixture(directory('./_fixtures/consumer/'))
            .exec('node readers.mjs');

        // Then - a module id and a specifier are read the same whichever loader the consumer's config runs under
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            import materialAt(src/orders.test.ts): a test file
            import materialAt(specs/api/_fixtures/app.ts): the specs tree
            import materialAt(specs): the specs tree
            import materialAt(src/orders.ts): none
            import testPackageOf(vitest/config): vitest
            import testPackageOf(@testing-library/react): @testing-library/react
            import testPackageOf(@jterrazz/test/oxlint): none
            import testPackageOf(hono): none
            require materialAt(src/orders.test.ts): a test file
            require materialAt(specs/api/_fixtures/app.ts): the specs tree
            require materialAt(specs): the specs tree
            require materialAt(src/orders.ts): none
            require testPackageOf(vitest/config): vitest
            require testPackageOf(@testing-library/react): @testing-library/react
            require testPackageOf(@jterrazz/test/oxlint): none
            require testPackageOf(hono): none
        `);
    });

    test('every global setup a project helper names is a module the install holds', async () => {
        // Given - a consumer's project building each project of the runner-config entry, as its vitest config does
        const result = await cli
            .fixture(directory('./_fixtures/consumer/'))
            .exec('node setups.mjs');

        // Then - each setup resolves inside the install: a renamed bundle would fail every consumer's run at startup
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            api: dist/in-place-setup.js (held), dist/temp-root.js (held), dist/services-setup.js (held), dist/route-coverage.js (held)
            cli: dist/in-place-setup.js (held), dist/temp-root.js (held)
            component: none
            integration: dist/in-place-setup.js (held), dist/temp-root.js (held), dist/services-setup.js (held)
            job: dist/in-place-setup.js (held), dist/temp-root.js (held), dist/services-setup.js (held)
            lint: dist/in-place-setup.js (held), dist/temp-root.js (held)
            mobile: dist/in-place-setup.js (held), dist/temp-root.js (held), dist/mobile-session.js (held)
            unit: dist/in-place-setup.js (held), dist/temp-root.js (held)
            website: dist/in-place-setup.js (held), dist/temp-root.js (held)
        `);
    });
});
