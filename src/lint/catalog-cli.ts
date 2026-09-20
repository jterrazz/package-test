#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { renderSchema } from '../core/literate/spec-document.js';
import { renderRules, spliceCatalog } from './catalog.js';
import { renderMatrix, spliceMatrix } from './matrix.js';

/**
 * CLI entry for the conventions-catalogue generator (bundled as
 * `dist/catalog.js`, chained into `npm run docs` BEFORE `typescript docs`).
 *
 *     node dist/catalog.js [repoRoot]     # default: cwd
 *
 * Regenerates three committed projections:
 *
 * - the full seven-channel catalogue inside `docs/13-linting.md` (between the
 *   GENERATED markers), from `src/lint/manifest.ts`;
 * - the agent-facing rule reference `skills/jterrazz-test/references/rules.md`,
 *   from the same manifest;
 * - `schema/spec.schema.json`, the published JSON Schema of the `<case>.spec.yaml`
 *   document, from the grammar's own constants;
 * - the capability matrix inside `docs/03-testing.md` (between its own GENERATED
 *   markers) and the agent-facing `skills/jterrazz-test/references/matrix.md`,
 *   from the facet declaration and a scan of the package's own trees.
 *
 * Deterministic — re-running with no source change is a no-op. `plugin.test.ts`
 * guards freshness.
 */
const root = resolve(process.argv[2] ?? '.');

const docsPath = resolve(root, 'docs/13-linting.md');
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
const nextTesting = spliceMatrix(testing, root);
if (nextTesting !== testing) {
    writeFileSync(testingPath, nextTesting);
}
writeFileSync(matrixPath, renderMatrix(root));

mkdirSync(dirname(schemaPath), { recursive: true });
writeFileSync(schemaPath, renderSchema());

console.log(
    'conventions catalogue: regenerated docs/13-linting.md + docs/03-testing.md (matrix) + skills/jterrazz-test/references/{rules,matrix}.md + schema/spec.schema.json',
);
