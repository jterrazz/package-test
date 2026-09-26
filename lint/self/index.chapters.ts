#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { renderSchema } from '../../src/facets/cli/documents/spec-document.js';
import { FAMILIES } from '../consumer/catalogue/families.js';
import { spliceFork } from '../consumer/catalogue/fork.js';
import { consumerRows } from '../consumer/catalogue/manifest.js';
import { spliceCatalogue } from '../engine/catalogue/chapter.js';
import { chapterWithSelfRules } from './catalogue/chapter.js';
import { spliceMatrix, spliceMatrixLayers } from './corpus/matrix.js';
import { spliceMetaTests } from './corpus/meta-tests.js';
import { spliceSiblings } from './corpus/siblings.js';

/** `node dist/catalogue.js [repoRoot]` (what `npm run docs` runs): regenerates every GENERATED table and the published schema; deterministic, and `self/catalogue/manifest.test.ts` guards freshness. */
const root = resolve(process.argv[2] ?? '.');

const docsPath = resolve(root, 'docs/19-linting.md');
const schemaPath = resolve(root, 'schema/spec.schema.json');
const testingPath = resolve(root, 'docs/03-testing.md');

const docs = readFileSync(docsPath, 'utf8');
const nextDocs = spliceCatalogue(docs, consumerRows, FAMILIES);
if (nextDocs !== docs) {
    writeFileSync(docsPath, nextDocs);
}

const testing = readFileSync(testingPath, 'utf8');
const withMatrix = spliceMatrix(testing, root);
const withLayers = spliceMatrixLayers(withMatrix, root);
const withSiblings = spliceSiblings(withLayers, root);
const nextTesting = chapterWithSelfRules(spliceMetaTests(withSiblings, root));
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
