import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const evidence = '.artifacts/vitest/evidence';
const named = { [`${process.pid}-alive`]: '<a living run>', '2147483646-done': '<a finished run>', 'website-old': '<a name no run gave>' };
for (const entry of Object.keys(named)) {
    mkdirSync(join(evidence, entry), { recursive: true });
}

const run = spawnSync('vitest', ['run'], { encoding: 'utf8' });
const left = readdirSync(evidence).map((entry) => named[entry] ?? entry);
process.stdout.write(`evidence kept: ${left.toSorted().join(', ')}\n`);
process.exitCode = run.status ?? 1;
