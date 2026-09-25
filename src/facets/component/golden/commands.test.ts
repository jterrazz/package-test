import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { BrowserCommandContext } from 'vitest/node';

import { scratchDirectory } from '../../../kernel/files/scratch.js';
import { COMPONENT_COMMANDS } from './commands.js';

function contextOf(
    testPath?: string,
    frames: { column: number; file: string; line: number }[] = [],
): BrowserCommandContext {
    const context = { project: { browser: { parseStacktrace: () => frames } }, testPath };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a command context is vitest's to build; the test hands the two fields these commands read
    return context as unknown as BrowserCommandContext;
}

describe('COMPONENT_COMMANDS', () => {
    test('goldenRead — a golden that does not exist yet — answers null, so the page records it in update mode', async () => {
        // Given - a test file whose golden was never written
        const directory = scratchDirectory('golden-read-');

        // When - the page reads it
        const read = await COMPONENT_COMMANDS.goldenRead(
            contextOf(join(directory, 'card.test.tsx')),
            './expected/card.aria.yaml',
        );

        // Then - no content, and no error
        expect(read).toBeNull();
    });

    test('goldenWrite — a golden under a folder that does not exist — creates the folder beside the test and answers the path it wrote', async () => {
        // Given - a test file with no expected/ folder beside it
        const directory = scratchDirectory('golden-write-');

        // When - update mode writes the golden
        const written = await COMPONENT_COMMANDS.goldenWrite(
            contextOf(join(directory, 'card.test.tsx')),
            './expected/card.aria.yaml',
            '- button "Save"\n',
        );

        // Then - the file sits beside the test, holding what was written
        const path = join(directory, 'expected', 'card.aria.yaml');
        expect(written).toBe(path);
        expect(readFileSync(path, 'utf8')).toBe('- button "Save"\n');
    });

    test('goldenRead — a command that carries no test path — refuses, since a golden is read from a test file', () => {
        // Given - a command context with no test behind it
        const context = contextOf();

        // When - the page reads a golden through it
        const read = (): unknown =>
            COMPONENT_COMMANDS.goldenRead(context, './expected/card.aria.yaml');

        // Then - the refusal names what is missing
        expect(read).toThrow(
            'golden: the command carries no test path — a golden is read from a test file.',
        );
    });

    test('inPlaceWrite — a stack no frame of which is the test file — refuses, and writes nothing', () => {
        // Given - a stack that maps only to a module outside the test
        const directory = scratchDirectory('in-place-write-');
        const testPath = join(directory, 'card.test.tsx');
        const frames = [{ column: 3, file: join(directory, 'card.tsx'), line: 12 }];

        // When - update mode asks to rewrite the value in place
        const write = (): unknown =>
            COMPONENT_COMMANDS.inPlaceWrite(contextOf(testPath, frames), 'Error\n', 'Saved');

        // Then - the refusal says the value has nowhere to be written, and no file appears
        expect(write).toThrow(
            'update mode: no frame of this toMatch call is the test file — the value in place has nowhere to be written.',
        );
        expect(existsSync(testPath)).toBe(false);
    });
});
