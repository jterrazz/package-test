import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { materialAt } from '../../reading/production.js';
import {
    augmentedPackages,
    builtEntry,
    citedDocPaths,
    compiledSources,
    exportedNames,
    ownManifest,
    requiredOfAConsumer,
    ROOT,
    sourceCitations,
    unpublished,
} from './package-exports.js';

describe('package-exports', () => {
    test('the root has two runtimes and one type surface — the root export answers a page under the browser condition', () => {
        // Given - the published map of the root export
        const root = ownManifest().exports['.'];

        // Then - a page gets the browser build, node keeps the ESM one, types are shared
        expect(root).toStrictEqual({
            browser: './dist/browser/index.js',
            import: './dist/index.js',
            types: './dist/index.d.ts',
        });
    });

    test('the root has two runtimes and one type surface — the browser build carries every name the node build exports', async () => {
        // Given - the node entry, and the page's bundle read as text: it opens browser Mode's own context module, which refuses to load under node — which is the very reason the second build exists (`npm run build` first)
        const node = await builtEntry('dist/index.js');
        const browser = exportedNames(readFileSync(resolve(ROOT, 'dist/browser/index.js'), 'utf8'));

        // Then - one surface: neither side has a name the other lacks
        expect(browser.toSorted()).toStrictEqual(Object.keys(node).toSorted());
    });

    test('the published types name what a consumer has — every package a declaration augments is a dependency or a required peer', () => {
        // Given - the packages the built declarations merge into (`npm run build` first)
        const augmented = augmentedPackages();

        // Then - a consumer typechecking them has each one, whatever it installed beside this package
        expect(augmented).toContain('@jterrazz/typescript');
        const required = requiredOfAConsumer();
        expect(augmented.filter((name) => !required.has(name))).toStrictEqual([]);
    });

    test('the tarball carries what a message points at — every chapter the README links is a file the install holds', () => {
        // Given - the vitrine, whose links are relative and therefore resolved inside the install
        const cited = citedDocPaths(readFileSync(resolve(ROOT, 'README.md'), 'utf8'));

        // Then - every one of them is under a published path and on disk
        expect(cited.length).toBeGreaterThan(0);
        expect(unpublished(cited)).toStrictEqual([]);
    });

    test('the tarball carries what a message points at — every chapter a diagnostic cites is a file the install holds', () => {
        // Given - the `(… — see docs/19-linting.md#…)` a rule message ends on: a consumer follows it inside node_modules
        const cited = sourceCitations();

        // Then - the anchor's file ships, so the pointer resolves where it is read
        expect(cited.length).toBeGreaterThan(0);
        expect(unpublished(cited)).toStrictEqual([]);
    });

    test('the build is compiled from production alone — no module a bundle is built from is test material', () => {
        // Given - the source modules every bundle's map lists (`npm run build` first)
        const sources = compiledSources();

        // Then - the facet constructors among them, and not one test, fixture, spec or ground file
        expect(sources).toContain(resolve(ROOT, 'src/facets/api/api.handle.ts'));
        const material = sources.filter((source) => materialAt(source) !== undefined);
        expect(material.map((source) => relative(ROOT, source))).toStrictEqual([]);
    });
});
