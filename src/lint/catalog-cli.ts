#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { renderSchema } from '../core/literate/spec-document.js';
import { KINDS, renderCard, renderFork, spliceFork } from './cards.js';
import { renderRules, spliceCatalog } from './catalog.js';
import { renderMatrix, spliceLayers, spliceMatrix } from './matrix.js';
import { spliceSiblings } from './siblings.js';

/**
 * CLI entry for the conventions-catalogue generator (bundled as
 * `dist/catalog.js`, chained into `npm run docs` BEFORE `typescript docs`).
 *
 *     node dist/catalog.js [repoRoot]     # default: cwd
 *
 * Regenerates three committed projections:
 *
 * - the full seven-channel catalogue inside `docs/19-linting.md` (between the
 *   GENERATED markers), from `src/lint/manifest.ts`;
 * - the agent-facing rule reference `skills/jterrazz-test/references/rules.md`,
 *   from the same manifest;
 * - `schema/spec.schema.json`, the published JSON Schema of the `<case>.spec.yaml`
 *   document, from the grammar's own constants;
 * - the layered reading, the capability matrix and the siblingless-module table
 *   inside `docs/03-testing.md`
 *   (each between its own GENERATED markers) and the agent-facing `skills/jterrazz-test/references/matrix.md`,
 *   from the facet declaration and a scan of the package's own trees;
 * - one signature card per kind of test, `skills/jterrazz-test/references/<kind>.md`,
 *   and the fork those cards branch from — `references/fork.md` and the table
 *   inside `docs/18-conventions.md` — from `src/lint/cards.ts`.
 *
 * Deterministic — re-running with no source change is a no-op. `plugin.test.ts`
 * guards freshness.
 */
const root = resolve(process.argv[2] ?? '.');

const docsPath = resolve(root, 'docs/19-linting.md');
const rulesPath = resolve(root, 'skills/jterrazz-test/references/rules.md');
const schemaPath = resolve(root, 'schema/spec.schema.json');
const testingPath = resolve(root, 'docs/03-testing.md');
const matrixPath = resolve(root, 'skills/jterrazz-test/references/matrix.md');

const docs = readFileSync(docsPath, 'utf8');
const nextDocs = spliceCatalog(docs);
if (nextDocs !== docs) {
    writeFileSync(docsPath, nextDocs);
}

writeFileSync(rulesPath, renderRules());

const testing = readFileSync(testingPath, 'utf8');
const nextTesting = spliceSiblings(spliceLayers(spliceMatrix(testing, root), root), root);
if (nextTesting !== testing) {
    writeFileSync(testingPath, nextTesting);
}
writeFileSync(matrixPath, renderMatrix(root));

const conventionsPath = resolve(root, 'docs/18-conventions.md');
const conventions = readFileSync(conventionsPath, 'utf8');
const nextConventions = spliceFork(conventions);
if (nextConventions !== conventions) {
    writeFileSync(conventionsPath, nextConventions);
}
const referencesDir = resolve(root, 'skills/jterrazz-test/references');
writeFileSync(resolve(referencesDir, 'fork.md'), renderFork());
for (const kind of KINDS) {
    writeFileSync(resolve(referencesDir, `${kind}.md`), renderCard(kind));
}

mkdirSync(dirname(schemaPath), { recursive: true });
writeFileSync(schemaPath, renderSchema());

console.log(
    'conventions catalogue: regenerated docs/19-linting.md + docs/03-testing.md (matrix) + docs/18-conventions.md (fork) + skills/jterrazz-test/references/{rules,matrix,fork,<kind>}.md + schema/spec.schema.json',
);
