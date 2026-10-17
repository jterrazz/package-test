import { relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { exportedNames } from '../../../kit/project/exported-names.js';
import { materialAt } from '../../../kit/project/material.js';
import { SUBPATH_NAMES } from '../../../kit/project/subpath-names.js';
import {
    augmentedPackages,
    compiledSources,
    requiredOfAConsumer,
    ROOT,
} from '../package-exports.js';

describe('package-exports', () => {
    test('the published types name what a consumer has — every package a declaration augments is a dependency or a required peer', () => {
        // Given - the packages the built declarations merge into (`npm run build` first)
        const augmented = augmentedPackages();

        // Then - a consumer typechecking them has each one, whatever it installed beside this package
        expect(augmented).toContain('@jterrazz/typescript');
        const required = requiredOfAConsumer();
        expect(augmented.filter((name) => !required.has(name))).toStrictEqual([]);
    });

    test('the build is compiled from production alone — no module a bundle is built from is test material', () => {
        // Given - the source modules every bundle's map lists (`npm run build` first)
        const sources = compiledSources();

        // Then - the specification constructors among them, and not one test, fixture, spec or ground file
        expect(sources).toContain(resolve(ROOT, 'src/specifications/api/api.handle.ts'));
        const material = sources.filter((source) => materialAt(source) !== undefined);
        expect(material.map((source) => relative(ROOT, source))).toStrictEqual([]);
    });

    test('the names a spec subpath publishes are the names rule `service-or-stub-from-its-subpath` moves, and the root publishes none of them', () => {
        // Given - what each entry publishes, read off its source
        const root = exportedNames(resolve(ROOT, 'src/index.ts'));
        const published = {
            '@jterrazz/test/services': exportedNames(resolve(ROOT, 'src/index.services.ts')),
            '@jterrazz/test/stubs': exportedNames(resolve(ROOT, 'src/index.stubs.ts')),
        };

        // Then - the rule's lists are each subpath's names, and none of them is the root's
        expect(
            Object.fromEntries(
                Object.entries(published).map(([subpath, names]) => [
                    subpath,
                    [...names].toSorted(),
                ]),
            ),
        ).toStrictEqual(
            Object.fromEntries(
                Object.entries(SUBPATH_NAMES).map(([subpath, names]) => [
                    subpath,
                    names.toSorted(),
                ]),
            ),
        );
        expect(
            Object.values(SUBPATH_NAMES)
                .flat()
                .filter((name) => root.has(name)),
        ).toStrictEqual([]);
    });
});
