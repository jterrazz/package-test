#!/usr/bin/env node
/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a gate that wrote anywhere else would be reporting to nobody. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { renderSchema } from '../../../../lint/engine/project/spec-document.js';

const schemaPath = resolve(process.argv[2] ?? '.', 'schema/spec.schema.json');
mkdirSync(dirname(schemaPath), { recursive: true });
writeFileSync(schemaPath, renderSchema());
console.log('schema: regenerated schema/spec.schema.json');
