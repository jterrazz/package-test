import { directory, packed } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('pages', () => {
    test('every page the install points a reader at is one the install holds', async () => {
        // Given - a consumer's project, reading the README and every installed module for the pages they cite
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@vitest/browser-playwright')
            .link('playwright')
            .link('react')
            .link('react-dom')
            .link('vitest-browser-react')
            .fixture(directory('./__fixtures__/consumer/'))
            .exec('pages.mjs');

        // Then - a diagnostic's `read:` and a README link resolve inside node_modules, where the consumer reads them
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            docs/README.md: held
            docs/concepts/conventions.md: held
            docs/guides/api-specs.md: held
            docs/guides/cli-specs.md: held
            docs/guides/component-specs.md: held
            docs/guides/deployment-specs.md: held
            docs/guides/integration-specs.md: held
            docs/guides/job-specs.md: held
            docs/guides/lint-specs.md: held
            docs/guides/mobile-specs.md: held
            docs/guides/module-tests.md: held
            docs/guides/spec-documents.md: held
            docs/guides/website-specs.md: held
            docs/reference/assertions.md: held
            docs/reference/linting.md: held
            docs/reference/services.md: held
            docs/reference/stubs.md: held
            docs/reference/time-and-doubles.md: held
            docs/reference/tokens.md: held
            docs/reference/visitor.md: held
            docs/start/getting-started.md: held
            docs/start/set-up-a-project.md: held
        `);
    });
});
