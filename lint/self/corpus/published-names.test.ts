import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { registerMatchers } from '../../../src/expectations/goldens/matchers.js';
import { text } from '../../../src/expectations/text/text-subject.js';
import { file } from '../../../src/kernel/files/spec-path.js';
import { exportedNames, renderPublishedNames } from './published-names.js';

const ROOT = resolve(import.meta.dirname, '../../..');

describe('published-names', () => {
    test('published names — the surface a consumer imports, by name — the three published entries export exactly the recorded names', async () => {
        // Given - the node types, the page bundle and the vitest types, as `npm run build` wrote them
        await registerMatchers();
        const published = renderPublishedNames(ROOT);

        // Then - a name that appears or disappears is a change of the public surface, recorded here
        expect(text(published)).toMatch(file('./_expected/published-names.txt'));
    });

    test("published names — the surface a consumer imports, by name — a chain refuses, under a consumer's compiler options, a setting its facet does not share", () => {
        // Given - a consumer module over the built types, compiled with `strict` alone: without the `exactOptionalPropertyTypes` this package checks itself under
        const root = mkdtempSync(join(tmpdir(), 'consumer-types-'));
        writeFileSync(
            join(root, 'consumer.ts'),
            [
                `import type { JobSpecification } from '${join(ROOT, 'dist', 'index.js')}';`,
                'declare const job: JobSpecification<never>;',
                "job.with({ headers: { 'accept-language': 'fr' } });",
            ].join('\n'),
        );
        const compiled = spawnSync(
            process.execPath,
            [
                resolve(ROOT, 'node_modules/typescript/bin/tsc'),
                '--noEmit',
                '--strict',
                '--skipLibCheck',
                '--pretty',
                'false',
                '--module',
                'esnext',
                '--moduleResolution',
                'bundler',
                '--target',
                'esnext',
                join(root, 'consumer.ts'),
            ],
            { cwd: root, encoding: 'utf8' },
        );

        // Then - `with()` takes the clock alone, as the source states it: a computed type must not widen in a consumer's build
        expect(compiled.stdout).toContain(
            `'headers' does not exist in type 'Pick<ChainContext, "clock">'`,
        );
    });

    test('published names — the surface a consumer imports, by name — a name is read in every form a declaration file publishes it', () => {
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
