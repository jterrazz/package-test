import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { formatRewritten } from '../formatter.js';

function scratchFile(source: string, folder = '.'): string {
    const directory = mkdtempSync(join(tmpdir(), 'in-place-format-'));
    const file = join(directory, folder, 'scratch.test.ts');
    mkdirSync(join(directory, folder), { recursive: true });
    writeFileSync(file, source);
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    return file;
}

describe('formatRewritten', () => {
    test('formatRewritten — a rewritten test file is laid out by the oxfmt the project installs', () => {
        // Given - a scratch project asking double quotes where this repository asks single, its node_modules holding this repository's oxfmt, and a test file two folders below written with single quotes
        const file = scratchFile("expect(one).toMatch({ 'id': 'x', 'n': 1 })\n", 'specs/cli');
        const project = join(file, '..', '..', '..');
        writeFileSync(join(project, '.oxfmtrc.json'), '{ "singleQuote": false }\n');
        const binaries = join(project, 'node_modules', '.bin');
        mkdirSync(binaries, { recursive: true });
        symlinkSync(
            resolve(import.meta.dirname, '../../../../node_modules/.bin/oxfmt'),
            join(binaries, 'oxfmt'),
        );

        const untouched = join(project, 'other.ts');
        writeFileSync(untouched, "export const other = { 'a': 1 }\n");

        // When - the run's rewrites are formatted
        formatRewritten([file]);

        // Then - the file reads in the style the project's formatter config asks, and no other file of the project moved
        expect([readFileSync(file, 'utf8'), readFileSync(untouched, 'utf8')]).toStrictEqual([
            'expect(one).toMatch({ id: "x", n: 1 });\n',
            "export const other = { 'a': 1 }\n",
        ]);
    });

    test('formatRewritten — a project with no oxfmt installed — leaves the file as written', () => {
        // Given - a scratch test file, under a tree holding no oxfmt
        const file = scratchFile('expect(one).toMatch({ "id": "x" })\n');

        // When - the run's rewrites are formatted
        formatRewritten([file]);

        // Then - the file is untouched
        expect(readFileSync(file, 'utf8')).toBe('expect(one).toMatch({ "id": "x" })\n');
    });
});
