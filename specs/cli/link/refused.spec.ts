import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('refused', () => {
    test('a bare name no node_modules above the spec holds is refused before the binary runs', async () => {
        // Given - a package the project never installed
        const run = cli.link('@acme/absent').exec('package @acme/absent');

        // Then - the refusal says where it looked, and the directory form
        await expect(run).rejects.toThrow(
            /found: link\('@acme\/absent'\): no node_modules from .*specs\/cli\/link up holds @acme\/absent\n.*\nfix: install @acme\/absent in the project the spec belongs to, or name the package's directory/u,
        );
    });

    test('a name no package carries is refused as it is stated', () => {
        // Given - a path where a package name is read

        // Then - the chain refuses it before anything runs
        expect(() => cli.link('../greeter')).toThrow(/link\("\.\.\/greeter"\), no package name/u);
    });
});
