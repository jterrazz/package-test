import { readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { anthropic, http, openai } from '../index.js';
import { STUB_KINDS } from './kinds.js';

describe('stub kinds — the builders a stub folder is named for', () => {
    test('names every builder folder of the package, each a builder its entry exports', () => {
        // Given - the builder folders under src/stubs/, and the builders the entry exports
        const folders = readdirSync(import.meta.dirname, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);
        const exported: Record<string, unknown> = { anthropic, http, openai };

        // Then - one kind per folder, and each kind is a builder the entry publishes
        expect(STUB_KINDS).toStrictEqual(folders.toSorted());
        expect(STUB_KINDS.map((kind) => typeof exported[kind])).toStrictEqual([
            'object',
            'object',
            'object',
        ]);
    });
});
