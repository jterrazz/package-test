import { spawnSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

import {
    hoistedClosure,
    linkBins,
    linkFromCheckout,
    readManifest,
    runtimeDependencies,
} from './closure.ts';

const installed = join(process.cwd(), 'node_modules');
const packed = process.env.PACKED_PACKAGE ?? unpacked();

function unpacked(): never {
    throw new Error(
        'PACKED_PACKAGE is unset: the packed specification hands it the tarball specs/cli/__setup__/packed/per-run.ts unpacked',
    );
}

function install(): void {
    cpSync(packed, join(installed, '@jterrazz', 'test'), { recursive: true });
    const project = existsSync(join(process.cwd(), 'package.json'))
        ? readManifest(process.cwd())
        : {};
    const own = [
        ...runtimeDependencies(project),
        ...Object.keys(project.devDependencies ?? {}),
    ].filter((name) => name !== '@jterrazz/test');
    for (const name of hoistedClosure([...runtimeDependencies(readManifest(packed)), ...own])) {
        linkFromCheckout(name, installed);
        linkBins(join(installed, name), installed);
    }
    linkBins(join(installed, '@jterrazz', 'test'), installed);
}

if (!existsSync(join(installed, '@jterrazz', 'test'))) {
    install();
}

const [command = '', ...args] = process.argv.slice(2);
const run = spawnSync(command, args, {
    env: { ...process.env, PATH: [join(installed, '.bin'), process.env.PATH].join(delimiter) },
    stdio: 'inherit',
});
process.exitCode = run.status ?? 1;
