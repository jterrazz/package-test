import { directory, packed } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('projects', () => {
    test('each project helper collects its own tree under its own name, a document titled by its description, and never ground', async () => {
        // Given - a consumer's config building every node project from the installed helpers, stated by nobody
        const result = await cli
            .link('@jterrazz/test', packed())
            .fixture(directory('./__fixtures__/projects/'))
            .exec('projects.mjs');

        // Then - a specification takes its specs, the cli its documents too, and the unit project every module test but a rendered one
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            [api] specs/api/orders/list.spec.ts > runs
            [api] specs/api/slow/report.spec.ts > runs
            [cli] specs/cli/greet.spec.yaml > greets the one it is handed
            [cli] specs/cli/greet/hello.spec.ts > runs
            [integration] specs/integration/orders/total.spec.ts > runs
            [job] specs/job/nightly/purge.spec.ts > runs
            [lint] specs/lint/rules/flag.spec.ts > runs
            [mobile] specs/mobile/login/sign-in.spec.ts > runs
            [unit] apps/web/route.test.ts > runs
            [unit] e2e/checkout.test.ts > runs
            [unit] packages/billing/invoice.test.ts > runs
            [unit] src/orders.test.ts > runs
            [unit] suites/api/health.test.ts > runs
            [website] specs/website/home/visit.spec.ts > runs
        `);
    });

    test('a helper collects the trees a project states instead of its own', async () => {
        // Given - the same project, its helpers handed roots, globs, an exclusion and no literate door
        const result = await cli
            .link('@jterrazz/test', packed())
            .fixture(directory('./__fixtures__/projects/'))
            .exec('projects.mjs vitest.stated.config.mjs');

        // Then - each collects what was stated: the unit project its roots, the api its globs less the excluded tree, the cli no document
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            [api] specs/api/orders/list.spec.ts > runs
            [api] suites/api/health.test.ts > runs
            [cli] specs/cli/greet/hello.spec.ts > runs
            [unit] apps/web/route.test.ts > runs
            [unit] packages/billing/invoice.test.ts > runs
            [website] e2e/checkout.test.ts > runs
        `);
    });

    test('a document the literate door collects that breaks its grammar fails the collection, its line and key named', async () => {
        // Given - the cli's documents narrowed to a folder holding one with a key outside the closed set, and vitest's error report coloured, as a GitHub runner prints it
        const result = await cli
            .link('@jterrazz/test', packed())
            .fixture(directory('./__fixtures__/projects/'))
            .env({ FORCE_COLOR: '1', NO_COLOR: null })
            .exec('projects.mjs vitest.documents.config.mjs');

        // Then - the run is refused at collection, in the grammar's words
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            found: documents/stray.spec.yaml:2: unknown key "when:" in a spec document; known keys: description, fixture, env, serve, runs
            why: A spec document follows one grammar, read by the parser the runner and the linter share: closed keys, \`description:\` and \`runs:\` required, \`command:\` and \`exit:\` in every run.
            fix: write the key the grammar names; the reason prints the accepted set
            read: docs/reference/linting.md#document-follows-its-grammar
        `);
    });
});
