#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { renderSchema } from '../src/model/literate/spec-document.js';
import { spliceCatalog, spliceSelfRules } from './catalog.js';
import { spliceFork } from './fork.js';
import { spliceLayers, spliceMatrix } from './matrix.js';
import { spliceMetaTests } from './meta-tests.js';
import { spliceSiblings } from './siblings.js';

/**
 * CLI entry for the conventions-catalogue generator (bundled as
 * `dist/catalog.js`, what `npm run docs` runs after the build).
 *
 *     node dist/catalog.js [repoRoot]     # default: cwd
 *
 * Regenerates the tables the manual carries between GENERATED markers, and the
 * published schema — each from the code that owns its facts:
 *
 * - the catalogue of the `consumer` rules inside `docs/19-linting.md`, and
 *   the table of the `self` rules inside `docs/03-testing.md`, from
 *   `lint/manifest.ts`;
 * - `schema/spec.schema.json`, the published JSON Schema of the `<case>.spec.yaml`
 *   document, from the grammar's own constants;
 * - the layered reading, the capability matrix, the meta-test channel and
 *   the siblingless-module table inside `docs/03-testing.md`, from the facet
 *   declaration and a scan of the package's own trees;
 * - the fork inside `docs/18-conventions.md`, from `lint/fork.ts`.
 *
 * Deterministic — re-running with no source change is a no-op. `plugin.test.ts`
 * guards freshness.
 */
const root = resolve(process.argv[2] ?? '.');

const docsPath = resolve(root, 'docs/19-linting.md');
const schemaPath = resolve(root, 'schema/spec.schema.json');
const testingPath = resolve(root, 'docs/03-testing.md');

const docs = readFileSync(docsPath, 'utf8');
const nextDocs = spliceCatalog(docs);
if (nextDocs !== docs) {
    writeFileSync(docsPath, nextDocs);
}

const testing = readFileSync(testingPath, 'utf8');
const withMatrix = spliceMatrix(testing, root);
const withLayers = spliceLayers(withMatrix, root);
const withSiblings = spliceSiblings(withLayers, root);
const nextTesting = spliceSelfRules(spliceMetaTests(withSiblings, root));
if (nextTesting !== testing) {
    writeFileSync(testingPath, nextTesting);
}

const conventionsPath = resolve(root, 'docs/18-conventions.md');
const conventions = readFileSync(conventionsPath, 'utf8');
const nextConventions = spliceFork(conventions);
if (nextConventions !== conventions) {
    writeFileSync(conventionsPath, nextConventions);
}

mkdirSync(dirname(schemaPath), { recursive: true });
writeFileSync(schemaPath, renderSchema());

console.log(
    'conventions catalogue: regenerated docs/19-linting.md + docs/03-testing.md + docs/18-conventions.md (fork) + schema/spec.schema.json',
);
