import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../transform-cli.specification.js';

describe('captures', () => {
    test("a ref captured on stdout holds in the working directory's files", async () => {
        // Given - a command writing one session id to stdout and to a file, captured on stdout
        const result = await cli.exec('session-file');
        expect(result.stdout).toMatch(`
            session {{uuid#session}}
        `);

        // Then - the tree is compared within the same capture scope, and the ref holds
        await expect(result.filesystem).toMatch(directory('./__expected__/session/'));
    });

    test("a ref captured on stdout refuses another value in the working directory's files", async () => {
        // Given - a command writing a different session id to stdout and to the file, captured on stdout
        const result = await cli.exec('two-session-files');
        expect(result.stdout).toMatch(`
            session {{uuid#session}}
        `);

        // Then - the file's id is held to the one stdout captured, and the comparison fails on it
        await expect(
            expect(result.filesystem).toMatch(directory('./__expected__/session/'), {
                frozen: true,
            }),
        ).rejects.toThrow(/changed.*out\/session\.txt/u);
    });
});
