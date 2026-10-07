import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('linked', () => {
    test('a named directory is the package the binary requires by that name', async () => {
        // Given - a package beside the spec, linked under a scoped name
        const result = await cli
            .link('@acme/greeter', directory('./__fixtures__/greeter/'))
            .exec('package @acme/greeter');

        // Then - Node resolves it from the working directory
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            @acme/greeter@1.0.0
        `);
    });

    test('a bare name is the package the spec’s own project installed', async () => {
        // Given - yaml, a dependency of the project this spec belongs to
        const result = await cli.link('yaml').exec('package yaml');

        // Then - the binary resolves the project's install
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            yaml@{{semver}}
        `);
    });

    test('without a link the working directory resolves no package', async () => {
        // Given - the same command, nothing linked
        const result = await cli.exec('package @acme/greeter');

        // Then - Node finds nothing from the fresh working directory
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain("Cannot find module '@acme/greeter/package.json'");
    });
});
