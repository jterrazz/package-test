import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { refusalsOf, typeRowsOf } from './type-channel.js';

const ROOT = resolve(import.meta.dirname, '..');
const CHANNEL = resolve(ROOT, 'src/type-channel.test-d.ts');
const CACHE = resolve(ROOT, 'node_modules/.cache');

/** What the compiler says on each line of a source whose markers are gone. */
function refusalsByLine(source: string): Map<number, string[]> {
    mkdirSync(CACHE, { recursive: true });
    const byLine = new Map<number, string[]>();
    for (const { code, line, message } of refusalsOf({
        cacheDir: CACHE,
        source,
        srcDir: resolve(ROOT, 'src'),
        tsconfig: resolve(ROOT, 'tsconfig.json'),
        tscBin: resolve(ROOT, 'node_modules/typescript/bin/tsc'),
    })) {
        byLine.set(line, [...(byLine.get(line) ?? []), `${code} ${message}`]);
    }
    return byLine;
}

describe('the type channel — each row refused for the reason it states (meta-test)', () => {
    test('every marker states the words of the error it is written for', () => {
        // Given - the channel's markers
        const { rows, unstated } = typeRowsOf(readFileSync(CHANNEL, 'utf8'));

        // Then - none is a bare `@ts-expect-error`, which any error would satisfy
        expect(unstated).toStrictEqual([]);
        expect(rows.length).toBeGreaterThan(0);
    });

    test('the compiler refuses each row with the error the row names, and nothing else fails', () => {
        // Given - the channel compiled with its markers taken out
        const source = readFileSync(CHANNEL, 'utf8');
        const { rows } = typeRowsOf(source);
        const byLine = refusalsByLine(source);

        // Then - each marked line carries its own error, and no unmarked line carries any
        for (const row of rows) {
            const said = byLine.get(row.line) ?? [];
            expect(
                said.some((message) => message.includes(row.expected)),
                `${row.id} — ${row.reason} (line ${row.line}): the compiler said ${JSON.stringify(said)}`,
            ).toBe(true);
        }
        const marked = new Set(rows.map((row) => row.line));
        expect([...byLine.keys()].filter((line) => !marked.has(line))).toStrictEqual([]);
    });

    test('a row refused for another reason than the one it names fails', () => {
        // Given - a row naming the error a bare string gets, on a verb that does not exist
        const source = [
            "import { specification } from './index.js';",
            'export async function row(): Promise<void> {',
            '    const { api } = await specification.api({ server: () => ({}) as never });',
            "    // @ts-expect-error B2 — a bare string is a value [`is not assignable to parameter of type 'DiskFile`]",
            "    await api.seedFrom('./seeds/x.sql');",
            '}',
            '',
        ].join('\n');
        const [row] = typeRowsOf(source).rows;

        // Then - the compiler refuses the line, but not with the words the row names
        const said = refusalsByLine(source).get(row?.line ?? 0) ?? [];
        expect(said).toHaveLength(1);
        expect(said.some((message) => message.includes(row?.expected ?? ''))).toBe(false);
    });
});
