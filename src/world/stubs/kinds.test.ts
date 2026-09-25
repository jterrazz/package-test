import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { anthropic, http, openai } from '../../index.js';
import { STUB_KINDS } from './kinds.js';

/** The folders beside this module whose `<name>.ts` exports a builder named `<name>`. */
async function builderFolders(): Promise<string[]> {
    const named = readdirSync(import.meta.dirname, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .filter((name) => existsSync(join(import.meta.dirname, name, `${name}.ts`)));
    const builders = await Promise.all(
        named.map(async (name) => {
            const loaded: unknown = await import(`./${name}/${name}.ts`);
            return typeof loaded === 'object' && loaded !== null && name in loaded ? [name] : [];
        }),
    );
    return builders.flat();
}

describe('kinds', () => {
    test('stub kinds — the builders a stub folder is named for — names every builder folder of the package, each a builder its entry exports', async () => {
        // Given - the folders under src/world/stubs/ exporting the builder they are named for, and the builders the entry exports
        const folders = await builderFolders();
        const exported: Record<string, unknown> = { anthropic, http, openai };

        // Then - one kind per builder folder, and each kind is a builder the entry publishes
        expect(STUB_KINDS).toStrictEqual(folders.toSorted());
        expect(STUB_KINDS.map((kind) => typeof exported[kind])).toStrictEqual([
            'object',
            'object',
            'object',
        ]);
    });
});
