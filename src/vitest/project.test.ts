import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { EXCLUDE, facetProject, inProcessProject, projectTest, statedOnce } from './project.js';

function testOf(
    project: TestProjectInlineConfiguration,
): NonNullable<TestProjectInlineConfiguration['test']> {
    return project.test ?? {};
}

describe('project', () => {
    test('facetProject — collects the facet’s spec files, in group 0, on the preset’s budget', () => {
        // Given - a facet project stated by nobody
        const project = testOf(facetProject('api', {}));

        // Then - its own specs tree, named for it, in parallel on the shared 30s, the run's two global setups from their sources
        expect(project.include).toStrictEqual(['specs/api/**/*.spec.ts']);
        expect(project.name).toBe('api');
        expect(project.sequence?.groupOrder).toBe(0);
        expect([project.fileParallelism, project.testTimeout]).toStrictEqual([undefined, 30_000]);
        expect(project.globalSetup).toStrictEqual([
            resolve(import.meta.dirname, '../expectations/in-place/in-place-setup.ts'),
            resolve(import.meta.dirname, '../chain/paths/temp-root.ts'),
        ]);
    });

    test('facetProject — adds a stated exclude to the preset’s', () => {
        // Given - a facet project that stays out of one folder
        const project = testOf(facetProject('api', { exclude: ['specs/api/slow/**'] }));

        // Then - the preset's ground folders are still out, and the stated one with them
        expect(project.exclude).toStrictEqual([...EXCLUDE, 'specs/api/slow/**']);
    });

    test('facetProject — runs its files one at a time on its own budget when stated', () => {
        // Given - a facet project that shares one app and needs a minute
        const project = testOf(facetProject('api', { serial: true, timeout: 60_000 }));

        // Then - no file parallelism, and the stated budget
        expect(project.fileParallelism).toBe(false);
        expect(project.testTimeout).toBe(60_000);
    });

    test('inProcessProject — shares one module graph per worker and reruns the specification before each file only when it names one', () => {
        // Given - the same facet with its specification named, and without
        const named = testOf(
            inProcessProject('api', { runner: './specs/api/api.specification.ts' }),
        );
        const unnamed = testOf(inProcessProject('api', {}));

        // Then - the named one runs its specification as a setup file over a shared graph; the other is the plain facet
        expect([
            { isolate: named.isolate, setupFiles: named.setupFiles },
            { isolate: unnamed.isolate, setupFiles: unnamed.setupFiles },
        ]).toStrictEqual([
            { isolate: false, setupFiles: ['./specs/api/api.specification.ts'] },
            { isolate: undefined, setupFiles: undefined },
        ]);
    });

    test('statedOnce — keeps each glob once, in the order it was first stated', () => {
        // Given - globs repeated by two merged configs
        const stated = { exclude: ['a', 'b', 'a'], include: ['c', 'c'], name: 'x' };

        // Then - each glob is kept once, and the rest is untouched
        expect(statedOnce(stated)).toStrictEqual({
            exclude: ['a', 'b'],
            include: ['c'],
            name: 'x',
        });
    });

    test('statedOnce — adds no list a config never stated', () => {
        // Given - a config stating neither list
        const stated: { exclude?: string[]; include?: string[]; name: string } = { name: 'x' };

        // Then - it comes back as it was, with no key for either list
        expect(statedOnce(stated)).toStrictEqual({ name: 'x' });
    });

    test('projectTest — states only what the facet and the options state', () => {
        // Given - a project with no exclude, no budget and no serial run stated anywhere
        const project = projectTest('unit', {}, { include: ['src/**/*.test.ts'] });

        // Then - the canonical include, the name and the group, and no key for what nobody stated
        expect(project).toStrictEqual({
            include: ['src/**/*.test.ts'],
            name: 'unit',
            sequence: { groupOrder: 0 },
        });
    });
});
