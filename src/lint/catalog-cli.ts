#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderAnnex, spliceDocsTable } from './catalog.js';

/**
 * CLI entry for the conventions-catalogue generator (bundled as
 * `dist/catalog.js`, chained into `npm run docs`).
 *
 *     node dist/catalog.js [repoRoot]     # default: cwd
 *
 * Rewrites the GENERATED rule table inside `docs/10-linting.md` and the annex
 * `CONVENTIONS-CATALOG.md` from `src/lint/manifest.ts`. Deterministic — re-running
 * with no manifest change is a no-op. `plugin.test.ts` guards freshness.
 */
const root = resolve(process.argv[2] ?? '.');

const docsPath = resolve(root, 'docs/10-linting.md');
const annexPath = resolve(root, 'CONVENTIONS-CATALOG.md');

const docs = readFileSync(docsPath, 'utf8');
const nextDocs = spliceDocsTable(docs);
if (nextDocs !== docs) {
    writeFileSync(docsPath, nextDocs);
}

const annex = renderAnnex();
writeFileSync(annexPath, annex);

console.log('conventions catalogue: regenerated docs/10-linting.md table + CONVENTIONS-CATALOG.md');
