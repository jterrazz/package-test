import { specification } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const SPECIMEN = resolve(import.meta.dirname, './__fixtures__/specimen-cli-go');
const GO_CLI_BIN = resolve(import.meta.dirname, '../../.artifacts/go/specimen-cli-go');

// outside: the Go toolchain is a machine requirement, never an npm dependency; the specimen is built by it before the runner meets it as it meets any binary.
execFileSync('go', ['build', '-o', GO_CLI_BIN, '.'], { cwd: SPECIMEN, stdio: 'inherit' });

export const { cleanup, cli } = await specification.cli(GO_CLI_BIN);

afterAll(cleanup);
