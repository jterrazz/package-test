import { spliceBetween } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { layers, MATRIX_LAYERS_MARKERS, renderMatrixLayers } from '../matrix-layers.js';
import { metaTests } from '../meta-tests.js';

const ROOT = resolve(import.meta.dirname, '../../../..');

const read = (relative: string): string => readFileSync(resolve(ROOT, relative), 'utf8');

describe('matrix-layers', () => {
    test('the layered reading is byte-identical to a fresh generation', () => {
        // Given - the layers block the Test page carries
        // Then - regenerating reproduces it exactly, counts included
        expect(
            spliceBetween(
                read('docs/guides/test.md'),
                MATRIX_LAYERS_MARKERS,
                renderMatrixLayers(ROOT),
                'docs/guides/test.md',
            ),
        ).toBe(read('docs/guides/test.md'));
    });

    test('every layer of the reading carries files', () => {
        // Given - the four layers the chapter publishes
        // Then - none of them is a claim with nothing behind it
        const found = layers(ROOT);
        expect(found).toHaveLength(5);
        expect(
            found.filter((layer) => layer.count === 0).map((layer) => layer.layer),
        ).toStrictEqual([]);
    });

    test('the meta-test layer counts the files the meta-test channel lists under `lint/`', () => {
        // Given - the layer, and the channel's own rows outside the end-to-end suite
        const layer = layers(ROOT).find((one) => one.layer === 'Meta-tests');
        const listed = metaTests(ROOT).filter((row) => !row.file.startsWith('specs/'));

        // Then - one count for one set of files, `lint/self/` included
        expect(layer?.count).toBe(listed.length);
    });
});
