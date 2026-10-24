import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const SPECIMEN = resolve(import.meta.dirname, '../../__fixtures__/specimen-cli-go');

/** The Go specimen's binary, built once per run before any worker starts. */
export const GO_CLI_BIN = resolve(import.meta.dirname, '../../../../.artifacts/go/specimen-cli-go');

// outside: the Go toolchain is a machine requirement, never an npm dependency; two `go build -o` of one output at once fail in its linker, so the build is the run's, never a spec file's.
export default function setup(): void {
    execFileSync('go', ['build', '-o', GO_CLI_BIN, '.'], { cwd: SPECIMEN, stdio: 'inherit' });
}
