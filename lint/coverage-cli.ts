#!/usr/bin/env node
/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a gate that wrote anywhere else would be reporting to nobody. */
import { resolve } from 'node:path';

import {
    BASELINE_FILE,
    drops,
    raised,
    readBaseline,
    readSummary,
    report,
    SUMMARY_FILE,
    writeBaseline,
} from './coverage.js';

/** `node dist/coverage.js` refuses a drop, `--write` records; `--scope <name>` keeps one project's floor apart. Neither runs the suite: they read the last `--coverage` report, or a second run could disagree with the first. */
const argv = process.argv.slice(2);
const write = argv.includes('--write');
const scopeFlag = argv.indexOf('--scope');
const scope = scopeFlag === -1 ? 'all' : (argv[scopeFlag + 1] ?? 'all');
const root = resolve('.');

const now = readSummary(root);
if (now === null) {
    console.error(
        `coverage: no report at ${SUMMARY_FILE} — run \`npx vitest --run --coverage\` first.`,
    );
    process.exit(1);
}

const baseline = readBaseline(root);
const floor = baseline[scope];

if (write) {
    const next = raised(floor, now);
    writeBaseline(root, { ...baseline, [scope]: next });
    console.log(`coverage: ${report(scope, next)} → ${BASELINE_FILE}`);
    process.exit(0);
}

const fell = drops(floor, now);
console.log(`coverage: ${report(scope, now)}`);
if (floor === undefined) {
    console.error(
        `coverage: ${BASELINE_FILE} has no \`${scope}\` floor — run \`npm run coverage\` to record one.`,
    );
    process.exit(1);
}
if (fell.length > 0) {
    for (const line of fell) {
        console.error(`coverage: ${line}`);
    }
    console.error(
        'coverage: the ratchet only rises. Cover what the change left bare, or lower the floor in a commit that says why.',
    );
    process.exit(1);
}
