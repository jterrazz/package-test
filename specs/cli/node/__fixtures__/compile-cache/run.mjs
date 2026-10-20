import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const cache = '.artifacts/node-compile-cache';
const { NODE_COMPILE_CACHE: _caller, ...env } = process.env;
const run = spawnSync('vitest', ['run'], { encoding: 'utf8', env });
const written = existsSync(cache) && readdirSync(cache, { recursive: true }).length > 0;
process.stdout.write(`${run.status === 0 ? 'the child read the cache' : run.stdout}\ncache written: ${written}\n`);
process.exitCode = run.status ?? 1;
