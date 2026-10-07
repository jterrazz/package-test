import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, inject, onTestFinished, test } from 'vitest';
import type { BrowserCommandContext } from 'vitest/node';

import { scratchDirectory } from '../../../../chain/paths/scratch.js';
import { deferRewritesTo } from '../../../../expectations/in-place/in-place.js';
import { COMPONENT_COMMANDS } from '../commands.js';

type Frame = { column: number; file: string; line: number };

/** A command context over a test path, whose browser maps any stack to these frames; `null` frames, a project with no browser. */
function contextOf(testPath?: string, frames: Frame[] | null = []): BrowserCommandContext {
    const context = {
        project: {
            browser: frames === null ? undefined : { parseStacktrace: () => frames },
            getProvidedContext: () => ({}),
        },
        testPath,
    };
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
            './__expected__/card.aria.yaml',
        );

        // Then - no content, and no error
        expect(read).toBeNull();
    });

    test('goldenWrite — a golden under folders that do not exist — creates them beside the test and answers the path it wrote', async () => {
        // Given - a test file with no __expected__/ folder beside it
        const directory = scratchDirectory('golden-write-');

        // When - update mode writes the golden
        const written = await COMPONENT_COMMANDS.goldenWrite(
            contextOf(join(directory, 'card.test.tsx')),
            './__expected__/cards/card.aria.yaml',
            '- button "Save"\n',
        );

        // Then - the file sits beside the test, holding what was written
        const path = join(directory, '__expected__', 'cards', 'card.aria.yaml');
        expect(written).toBe(path);
        expect(readFileSync(path, 'utf8')).toBe('- button "Save"\n');
    });

    test('goldenRead — a command that carries no test path — refuses, since a golden is read from a test file', () => {
        // Given - a command context with no test behind it
        const context = contextOf();

        // When - the page reads a golden through it
        const read = (): unknown =>
            COMPONENT_COMMANDS.goldenRead(context, './__expected__/card.aria.yaml');

        // Then - the refusal names what is missing
        expect(read).toThrow('a golden command reached the server with no test path');
        expect(() => COMPONENT_COMMANDS.inPlaceWrite(context, 'Error\n', 'Saved')).toThrow(
            'a golden command reached the server with no test path',
        );
    });

    test('goldenRead — a golden named by a path not relative to the test — is refused in the words of toMatch', () => {
        // Given - a golden named from the root
        const context = contextOf(join(scratchDirectory('golden-absolute-'), 'card.test.tsx'));

        // Then - refused as toMatch's own path
        expect(() =>
            COMPONENT_COMMANDS.goldenRead(context, '/__expected__/card.aria.yaml'),
        ).toThrow(
            'found: toMatch("/__expected__/card.aria.yaml"), a path that is not relative to the spec file',
        );
    });

    test('inPlaceWrite — the frame of the test file among others — rewrites the value where that frame stands, and answers the site', () => {
        // Given - a test file written at once, and a stack whose first frame is a module outside it
        deferRewritesTo(null);
        onTestFinished(() => {
            deferRewritesTo(() => inject('inPlaceRewrites'));
        });
        const directory = scratchDirectory('in-place-write-');
        const testPath = join(directory, 'card.test.tsx');
        writeFileSync(testPath, 'expect(one).toMatch(``);\n');
        const frames = [
            { column: 3, file: join(directory, 'card.tsx'), line: 12 },
            { column: 13, file: testPath, line: 1 },
        ];

        // When - update mode writes the value in place
        const site = COMPONENT_COMMANDS.inPlaceWrite(
            contextOf(testPath, frames),
            'Error\n',
            'Saved',
        );

        // Then - the test file holds it, at the site answered
        expect([site, readFileSync(testPath, 'utf8')]).toStrictEqual([
            `${testPath}:1`,
            'expect(one).toMatch(`Saved`);\n',
        ]);
    });

    test('inPlaceWrite — a stack no frame of which is the test file, or no stack at all — refuses, and writes nothing', () => {
        // Given - a stack that maps only to a module outside the test
        const directory = scratchDirectory('in-place-write-');
        const testPath = join(directory, 'card.test.tsx');
        const frames = [{ column: 3, file: join(directory, 'card.tsx'), line: 12 }];

        // When - update mode asks to rewrite the value in place
        const write = (): unknown =>
            COMPONENT_COMMANDS.inPlaceWrite(contextOf(testPath, frames), 'Error\n', 'Saved');

        // Then - the refusal says the value has nowhere to be written, with a browser or without one, and no file appears
        const refusal = new Error(
            [
                'found: update mode: no frame of this toMatch call is the test file — the value in place has nowhere to be written',
                'why: A value written in place is rewritten in the test that states it.',
                'fix: call toMatch() from the test file itself, or compare to a golden file: toMatch(file(…))',
                'read: docs/reference/tokens.md#a-value-written-in-place-is-rewritten-in-the-test',
            ].join('\n'),
        );
        expect(write).toThrow(refusal);
        expect(() =>
            COMPONENT_COMMANDS.inPlaceWrite(contextOf(testPath, null), 'Error\n', 'Saved'),
        ).toThrow(refusal);
        expect(existsSync(testPath)).toBe(false);
    });
});
