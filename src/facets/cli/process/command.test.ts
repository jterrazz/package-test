import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../../kernel/files/scratch.js';
import { resolveCommand } from './command.js';

function rootWithTool(): string {
    const root = scratchDirectory('command-resolution-');
    mkdirSync(resolve(root, 'node_modules/.bin'), { recursive: true });
    writeFileSync(resolve(root, 'node_modules/.bin/mytool'), '#!/bin/sh\n');
    return root;
}

describe('resolveCommand', () => {
    test('an absolute command passes through untouched', () => {
        // Given - an absolute binary path
        const root = rootWithTool();

        // Then - it is returned as-is
        expect(resolveCommand('/usr/bin/env', root)).toBe('/usr/bin/env');
    });

    test("prefers the root's node_modules/.bin when the command is installed there", () => {
        // Given - mytool present under <root>/node_modules/.bin
        const root = rootWithTool();

        // Then - the local bin path wins over bare PATH resolution
        expect(resolveCommand('mytool', root)).toBe(resolve(root, 'node_modules/.bin/mytool'));
    });

    test('falls back to the bare command for PATH resolution', () => {
        // Given - a command absent from every node_modules/.bin
        const root = rootWithTool();

        // Then - the bare name is returned for the shell to resolve
        expect(resolveCommand('definitely-not-installed-xyz', root)).toBe(
            'definitely-not-installed-xyz',
        );
    });
});
