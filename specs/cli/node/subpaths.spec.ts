import { directory, packed } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('subpaths', () => {
    test('every target the exports map publishes is in the install, and loads under its condition', async () => {
        // Given - a consumer's project with the tarball installed
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@vitest/browser-playwright')
            .link('playwright')
            .link('react')
            .link('react-dom')
            .link('vitest-browser-react')
            .fixture(directory('./__fixtures__/consumer/'))
            .exec('subpaths.mjs');

        // Then - each subpath answers every condition it declares: node loads its builds, and every package the browser build's one module imports (static, side-effect or dynamic) resolves under the browser condition
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            @jterrazz/test (types) → ./dist/index.d.ts: held
            @jterrazz/test (browser) → ./dist/browser/index.js: reaches 2 modules, imports @jterrazz/typescript/rules, msw, msw/browser, vitest, vitest-browser-react, vitest-mock-extended, vitest/browser, each resolved under the browser condition
            @jterrazz/test (import) → ./dist/index.js: loads, 39 names
            @jterrazz/test/services (types) → ./dist/services.d.ts: held
            @jterrazz/test/services (browser) → ./dist/browser/services.js: reaches 2 modules, imports @jterrazz/typescript/rules, msw, msw/browser, vitest, vitest-browser-react, vitest-mock-extended, vitest/browser, each resolved under the browser condition
            @jterrazz/test/services (import) → ./dist/services.js: loads, 5 names
            @jterrazz/test/stubs (types) → ./dist/stubs.d.ts: held
            @jterrazz/test/stubs (browser) → ./dist/browser/stubs.js: reaches 2 modules, imports @jterrazz/typescript/rules, msw, msw/browser, vitest, vitest-browser-react, vitest-mock-extended, vitest/browser, each resolved under the browser condition
            @jterrazz/test/stubs (import) → ./dist/stubs.js: loads, 6 names
            @jterrazz/test/vitest (types) → ./dist/vitest.d.ts: held
            @jterrazz/test/vitest (import) → ./dist/vitest.js: loads, 11 names
            @jterrazz/test/config (types) → ./dist/config.d.ts: held
            @jterrazz/test/config (import) → ./dist/config.js: loads, 1 name
            @jterrazz/test/oxlint (types) → ./dist/oxlint.d.ts: held
            @jterrazz/test/oxlint (import) → ./dist/oxlint.js: loads, 4 names
            @jterrazz/test/oxlint (types) → ./dist/oxlint.d.cts: held
            @jterrazz/test/oxlint (require) → ./dist/oxlint.cjs: loads, 4 names
            @jterrazz/test/schema (default) → ./schema/spec.schema.json: loads, 9 names
        `);
    });

    test('the node entry loads no library a spec pays for only when it declares one', async () => {
        // Given - a consumer's project importing the node entry into a fresh module graph
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@vitest/browser-playwright')
            .link('playwright')
            .link('react')
            .link('react-dom')
            .link('vitest-browser-react')
            .fixture(directory('./__fixtures__/consumer/'))
            .exec('eager.mjs');

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

    test('the services entry loads no database driver and no container runtime until a spec starts a service', async () => {
        // Given - a consumer's project importing the services entry into a fresh module graph
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@vitest/browser-playwright')
            .link('playwright')
            .link('react')
            .link('react-dom')
            .link('vitest-browser-react')
            .fixture(directory('./__fixtures__/consumer/'))
            .exec('eager.mjs @jterrazz/test/services');

        // Then - each driver stays behind the lazy import of the service that needs it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            @jterrazz/typescript
        `);
    });

    test('the stubs entry loads no network double until a spec serves a stub', async () => {
        // Given - a consumer's project importing the stubs entry into a fresh module graph
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@vitest/browser-playwright')
            .link('playwright')
            .link('react')
            .link('react-dom')
            .link('vitest-browser-react')
            .fixture(directory('./__fixtures__/consumer/'))
            .exec('eager.mjs @jterrazz/test/stubs');

        // Then - the builders are data: msw stays behind the delivery that serves them
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            @jterrazz/typescript
        `);
    });

    test('the oxlint entry answers what test material is alike from its ESM and its CommonJS build', async () => {
        // Given - a consumer's project asking both builds the questions its `no-test-code-in-production` guard asks
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@vitest/browser-playwright')
            .link('playwright')
            .link('react')
            .link('react-dom')
            .link('vitest-browser-react')
            .fixture(directory('./__fixtures__/consumer/'))
            .exec('readers.mjs');

        // Then - a module id and a specifier are read the same whichever loader the consumer's config runs under
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            import materialAt(src/orders.test.ts): a test file
            import materialAt(specs/api/__fixtures__/app.ts): the specs tree
            import materialAt(specs): the specs tree
            import materialAt(src/orders.ts): none
            import testPackageOf(vitest/config): vitest
            import testPackageOf(@testing-library/react): @testing-library/react
            import testPackageOf(@jterrazz/test/oxlint): none
            import testPackageOf(hono): none
            require materialAt(src/orders.test.ts): a test file
            require materialAt(specs/api/__fixtures__/app.ts): the specs tree
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
            .link('@jterrazz/test', packed())
            .link('@vitest/browser-playwright')
            .link('playwright')
            .link('react')
            .link('react-dom')
            .link('vitest-browser-react')
            .link('vite')
            .fixture(directory('./__fixtures__/consumer/'))
            .exec('setups.mjs');

        // Then - each setup resolves inside the install: a renamed bundle would fail every consumer's run at startup
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            api: dist/in-place.global-setup.js (held), dist/temp-root.global-setup.js (held), dist/services.global-setup.js (held), dist/route-coverage.global-setup.js (held)
            cli: dist/in-place.global-setup.js (held), dist/temp-root.global-setup.js (held)
            component: none
            integration: dist/in-place.global-setup.js (held), dist/temp-root.global-setup.js (held), dist/services.global-setup.js (held)
            job: dist/in-place.global-setup.js (held), dist/temp-root.global-setup.js (held), dist/services.global-setup.js (held)
            lint: dist/in-place.global-setup.js (held), dist/temp-root.global-setup.js (held)
            mobile: dist/in-place.global-setup.js (held), dist/temp-root.global-setup.js (held), dist/mobile-session.global-setup.js (held)
            unit: dist/in-place.global-setup.js (held), dist/temp-root.global-setup.js (held)
            website: dist/in-place.global-setup.js (held), dist/temp-root.global-setup.js (held)
        `);
    });
});
