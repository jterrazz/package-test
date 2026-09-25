import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { file } from '../src/model/chain/spec-path.js';
import { registerMatchers } from '../src/model/goldens/matchers.js';
import { text } from '../src/results/text-subject.js';
import { exportedNames, renderPublishedNames } from './published-names.js';

/** The repository root, from this module's place inside `lint/`. */
const ROOT = resolve(import.meta.dirname, '..');

describe('published names — the surface a consumer imports, by name', () => {
    test('the three published entries export exactly the recorded names', async () => {
        // Given - the node types, the page bundle and the vitest types, as `npm run build` wrote them
        await registerMatchers();
        const published = renderPublishedNames(ROOT);

        // Then - a name that appears or disappears is a change of the public surface, recorded here
        expect(text(published)).toMatch(file('./expected/published-names.txt'));
    });

    test('a name is read in every form a declaration file publishes it', () => {
        // Given - a declaration file exporting by declaration, by list, renamed, and twice through an overload
        const root = mkdtempSync(join(tmpdir(), 'published-names-'));
        writeFileSync(
            join(root, 'entry.d.ts'),
            [
                'export declare function run(a: string): void;',
                'export declare function run(a: number): void;',
                'export declare const one: number, two: number;',
                'export type Shape = { a: string };',
                'export interface Port { b: string }',
                'declare class Local {}',
                'export { Local as Published, type Shape as Alias };',
            ].join('\n'),
        );

        // Then - each published name once, the local name of a renamed export never
        expect(exportedNames(root, 'entry.d.ts')).toStrictEqual([
            'Alias',
            'Port',
            'Published',
            'Shape',
            'one',
            'run',
            'two',
        ]);
    });
});
