import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

const READ = 'read: docs/guides/cli-specs.md#cwd--a-folder-of-the-working-directory';

describe('cwd', () => {
    test('a command runs in the folder of the working directory it names', async () => {
        // Given - a workspace fixture, and a command run from its member
        const result = await cli
            .fixture(directory('./__fixtures__/workspace/'))
            .exec('here', { cwd: 'packages/site' });

        // Then - the binary ran in the member's folder
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            site
        `);
    });

    test.each(['../outside', '/tmp'])(
        'a folder outside the working directory, %j, is refused before anything runs',
        async (cwd) => {
            // Given - a cwd that leaves the tree the chain laid
            const run = cli.exec('here', { cwd });

            // Then - refused, naming the form to write
            await expect(run).rejects.toThrow(
                [
                    `found: .exec(…, { cwd: ${JSON.stringify(cwd)} }), a folder outside the working directory`,
                    'why: A command runs in the working directory the chain laid, or in one of its folders: anywhere else is the machine, not the fixture.',
                    "fix: name a folder below the working directory, relative to it: .exec('check', { cwd: 'packages/site' })",
                    READ,
                ].join('\n'),
            );
        },
    );

    test('a folder the fixtures never laid is refused', async () => {
        // Given - a cwd naming a member the workspace does not hold
        const run = cli
            .fixture(directory('./__fixtures__/workspace/'))
            .exec('here', { cwd: 'packages/absent' });

        // Then - refused, naming where the folder comes from
        await expect(run).rejects.toThrow(
            [
                'found: .exec(…, { cwd: "packages/absent" }), a folder the working directory does not hold',
                'why: A command runs in a folder the chain laid: one that does not exist has no files of the fixture.',
                'fix: lay the folder with a fixture, or name one the fixtures laid',
                READ,
            ].join('\n'),
        );
    });
});
