import { execFileSync } from 'node:child_process';
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

import { isRecord } from '../../lint/kit/project/json-shape.js';
import { refusal } from '../chain/refusals/refusal.js';
import { installedPackage } from './installed-package.js';

type Manifest = {
    bin: Readonly<Record<string, string>>;
    name: string | undefined;
    runtime: readonly string[];
};

function keysOf(value: unknown): string[] {
    return isRecord(value) ? Object.keys(value) : [];
}

function manifestAt(directory: string): Manifest {
    const parsed: unknown = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    const field = (key: string): unknown => (isRecord(parsed) ? parsed[key] : undefined);
    const name = field('name');
    const bin = field('bin');
    const meta = field('peerDependenciesMeta');
    const optional = (peer: string): boolean =>
        isRecord(meta) && isRecord(meta[peer]) && meta[peer].optional === true;
    const bare = typeof name === 'string' ? (name.split('/').at(-1) ?? name) : '';
    return {
        bin:
            typeof bin === 'string'
                ? { [bare]: bin }
                : Object.fromEntries(
                      Object.entries(isRecord(bin) ? bin : {}).filter(
                          (entry): entry is [string, string] => typeof entry[1] === 'string',
                      ),
                  ),
        name: typeof name === 'string' ? name : undefined,
        runtime: [
            ...keysOf(field('dependencies')),
            ...keysOf(field('optionalDependencies')),
            ...keysOf(field('peerDependencies')).filter((peer) => !optional(peer)),
        ],
    };
}

function projectOf(testDir: string): string {
    for (let directory = testDir; ; directory = dirname(directory)) {
        if (existsSync(join(directory, 'package.json'))) {
            return directory;
        }
        if (dirname(directory) === directory) {
            throw new Error(
                refusal({
                    fix: "run the spec inside the package it specifies, or name the package: packed(directory('./…/'))",
                    found: `packed(): no package.json from ${testDir} up`,
                    read: 'docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
                    why: 'packed() packs the project the spec belongs to, which its nearest package.json names.',
                }),
            );
        }
    }
}

const UNPACKED = new Map<string, string>();

// invariant: one pack per package and process — the tarball is what the checkout's build holds when the first spec asks for it.
function unpackedOf(packageRoot: string): string {
    const known = UNPACKED.get(packageRoot);
    if (known !== undefined) {
        return known;
    }
    const into = mkdtempSync(join(tmpdir(), 'jterrazz-packed-'));
    process.once('exit', () => {
        rmSync(into, { force: true, recursive: true });
    });
    const filename = execFileSync(
        'npm',
        ['pack', '--ignore-scripts', '--silent', '--pack-destination', into],
        { cwd: packageRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
        .trim()
        .split('\n')
        .at(-1);
    execFileSync('tar', ['-xzf', join(into, filename ?? ''), '-C', into]);
    const unpacked = join(into, 'package');
    UNPACKED.set(packageRoot, unpacked);
    return unpacked;
}

function linkInto(modules: string, name: string, source: string): void {
    const destination = join(modules, name);
    if (existsSync(destination)) {
        return;
    }
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(source, destination, 'dir');
}

/** Lays the packed package at `node_modules/<name>` as a copy, beside a link to each package its manifest requires at runtime, resolved from where the package is developed. */
export function installPacked(
    name: string,
    path: null | string,
    testDir: string,
    workDir: string,
): void {
    const packageRoot = path === null ? projectOf(testDir) : resolve(testDir, path);
    const declared = manifestAt(packageRoot).name;
    if (declared !== name) {
        throw new Error(
            refusal({
                fix: `link it under the name its package.json declares: link('${declared ?? '<no name>'}', packed(…))`,
                found: `link('${name}', packed()) packs ${relative(testDir, packageRoot) || '.'}, whose package.json names ${declared ?? 'no package'}`,
                read: 'docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
                why: 'A consumer imports a package by the name it is published under, so the install lays it there.',
            }),
        );
    }
    const unpacked = unpackedOf(packageRoot);
    const modules = join(workDir, 'node_modules');
    const destination = join(modules, name);
    rmSync(destination, { force: true, recursive: true });
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(unpacked, destination, { recursive: true });
    const manifest = manifestAt(unpacked);
    for (const dependency of manifest.runtime) {
        const installed = installedPackage(dependency, packageRoot);
        if (installed === null) {
            throw new Error(
                refusal({
                    fix: `install ${dependency} where ${name} is developed, as its consumers' install would`,
                    found: `link('${name}', packed()): ${name} requires ${dependency}, which no node_modules above ${relative(testDir, packageRoot) || '.'} holds`,
                    read: 'docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
                    why: 'The packed package is laid beside what its manifest requires at runtime, taken from where it is developed.',
                }),
            );
        }
        linkInto(modules, dependency, installed);
    }
    mkdirSync(join(modules, '.bin'), { recursive: true });
    for (const [command, target] of Object.entries(manifest.bin)) {
        const link = join(modules, '.bin', command);
        rmSync(link, { force: true });
        symlinkSync(relative(join(modules, '.bin'), join(destination, target)), link);
    }
}
