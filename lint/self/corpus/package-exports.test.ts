import { relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { materialAt } from '../../kit/project/material.js';
import {
    augmentedPackages,
    compiledSources,
    requiredOfAConsumer,
    ROOT,
} from './package-exports.js';

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
});
