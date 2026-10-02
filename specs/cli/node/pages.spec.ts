import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('pages', () => {
    test('every chapter the install points a reader at is a page the install holds', async () => {
        // Given - a consumer's project, reading the README and every installed module for the chapters they cite
        const result = await cli.fixture(directory('./_fixtures/consumer/')).exec('node pages.mjs');

        // Then - a diagnostic's `read:` and a README link resolve inside node_modules, where the consumer reads them
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            docs/01-architecture.md: held
            docs/05-getting-started.md: held
            docs/06-setting-up.md: held
            docs/07-module-tests.md: held
            docs/08-integration.md: held
            docs/09-component.md: held
            docs/10-website.md: held
            docs/11-mobile.md: held
            docs/12-api.md: held
            docs/13-job.md: held
            docs/14-cli.md: held
            docs/15-documents.md: held
            docs/16-lint.md: held
            docs/17-stubs.md: held
            docs/18-services.md: held
            docs/19-time-and-doubles.md: held
            docs/20-visitor.md: held
            docs/21-assertions.md: held
            docs/22-tokens.md: held
            docs/23-conventions.md: held
            docs/24-linting.md: held
            docs/README.md: held
        `);
    });
});
