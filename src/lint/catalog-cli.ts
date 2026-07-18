#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderRules, spliceCatalog } from './catalog.js';

/**
 * CLI entry for the conventions-catalogue generator (bundled as
 * `dist/catalog.js`, chained into `npm run docs` BEFORE `typescript docs`).
 *
 *     node dist/catalog.js [repoRoot]     # default: cwd
 *
 * Regenerates two committed projections from `src/lint/manifest.ts`:
 *
 * - the full four-channel catalogue inside `docs/10-linting.md` (between the
 *   GENERATED markers);
 * - the agent-facing rule reference `skills/jterrazz-test/references/rules.md`.
 *
 * Deterministic — re-running with no manifest change is a no-op. `plugin.test.ts`
 * guards freshness.
 */
const root = resolve(process.argv[2] ?? '.');

const docsPath = resolve(root, 'docs/10-linting.md');
const rulesPath = resolve(root, 'skills/jterrazz-test/references/rules.md');

const docs = readFileSync(docsPath, 'utf8');
const nextDocs = spliceCatalog(docs);
if (nextDocs !== docs) {
    writeFileSync(docsPath, nextDocs);
}

writeFileSync(rulesPath, renderRules());

console.log(
    'conventions catalogue: regenerated docs/10-linting.md + skills/jterrazz-test/references/rules.md',
);
