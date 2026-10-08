import { execFileSync, spawnSync } from 'node:child_process';
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
import { dirname, join, relative } from 'node:path';

import { isRecord } from '../../lint/kit/project/json-shape.js';
import { refusal } from '../chain/refusals/refusal.js';
import { installedPackage } from './installed-package.js';
import { linkedDirectory, refuseUnusableAncestor } from './link-destination.js';

type Manifest = {
    bin: Readonly<Record<string, string>>;
    name: string | undefined;
    runtime: readonly string[];
};

function keysOf(value: unknown): string[] {
    return isRecord(value) ? Object.keys(value) : [];
}

// Stryker disable next-line Regex: a package name holds its scope at its start or nowhere
const SCOPE = /^@[^/]+\//u;

// outside: npm names a string `bin` after the package, its scope dropped; a manifest naming no package names no command.
function binOf(name: unknown, bin: unknown): Record<string, string> {
    if (typeof bin === 'string') {
        return typeof name === 'string' ? { [name.replace(SCOPE, '')]: bin } : {};
    }
    return Object.fromEntries(
        Object.entries(isRecord(bin) ? bin : {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
    );
}

function parsedManifest(directory: string): unknown {
    const path = join(directory, 'package.json');
    try {
        return JSON.parse(readFileSync(path).toString());
    } catch (error) {
        throw new Error(
            refusal({
                fix: `correct ${path}, so npm and Node read the package it describes`,
                found: `packed(): ${path} is no JSON — ${error instanceof Error ? error.message : String(error)}`,
                read: 'docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
                why: 'packed() reads the name, the bin and the runtime closure the package declares in its package.json.',
            }),
            { cause: error },
        );
    }
}

function manifestAt(directory: string): Manifest {
    const parsed = parsedManifest(directory);
    const field = (key: string): unknown => (isRecord(parsed) ? parsed[key] : undefined);
    const name = field('name');
    const meta = field('peerDependenciesMeta');
    const optional = (peer: string): boolean =>
        isRecord(meta) && isRecord(meta[peer]) && meta[peer].optional === true;
    return {
        bin: binOf(name, field('bin')),
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

function packageDirectory(name: string, path: string, testDir: string): string {
    const call = `link('${name}', packed(directory(${JSON.stringify(path)})))`;
    const directory = linkedDirectory(call, path, testDir);
    if (!existsSync(join(directory, 'package.json'))) {
        throw new Error(
            refusal({
                fix: `name the directory that holds the package's package.json, or give ${directory} one`,
                found: `${call}: ${directory} holds no package.json`,
                read: 'docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
                why: 'packed() packs a package, and a package is the directory its package.json describes.',
            }),
        );
    }
    return directory;
}

const UNPACKED = new Map<string, string>();

// invariant: one pack per package and process — the tarball is what the checkout's build holds when the first spec asks for it.
function unpackedOf(packageRoot: string): string {
    const known = UNPACKED.get(packageRoot);
    // Stryker disable next-line ConditionalExpression,BlockStatement: packing again lays the same files, only slower
    if (known !== undefined) {
        return known;
    }
    // Stryker disable StringLiteral: the folder's prefix and the event that clears it are no part of what is laid
    const into = mkdtempSync(join(tmpdir(), 'jterrazz-packed-'));
    process.once('exit', () => {
        rmSync(into, { force: true, recursive: true });
    });
    // Stryker restore StringLiteral
    const filename = packInto(packageRoot, into);
    execFileSync('tar', ['-xzf', join(into, filename), '-C', into]);
    const unpacked = join(into, 'package');
    // Stryker disable next-line CallExpression: as above, a package packed again is the same package
    UNPACKED.set(packageRoot, unpacked);
    return unpacked;
}

function packInto(packageRoot: string, into: string): string {
    const packing = spawnSync(
        'npm',
        ['pack', '--ignore-scripts', '--silent', '--pack-destination', into],
        { cwd: packageRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    if (packing.status !== 0) {
        throw new Error(
            refusal({
                fix: `run \`npm pack\` in ${packageRoot} and settle what npm says, so the package packs as it would be published`,
                found: `packed(): \`npm pack\` failed in ${packageRoot}${packing.error === undefined ? '' : ` (${packing.error.message})`}:\n${packing.stderr.trim()}`,
                read: 'docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
                why: 'packed() lays the tarball npm writes for the package, so a package npm cannot pack gives it nothing to lay.',
            }),
        );
    }
    return packing.stdout.trim().split('\n').at(-1) ?? '';
}

function linkInto(workDir: string, name: string, source: string): void {
    const destination = join(workDir, 'node_modules', name);
    refuseUnusableAncestor(name, workDir, destination);
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
    const packageRoot = path === null ? projectOf(testDir) : packageDirectory(name, path, testDir);
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
    const modules = join(workDir, 'node_modules');
    const destination = join(modules, name);
    refuseUnusableAncestor(name, workDir, destination);
    const unpacked = unpackedOf(packageRoot);
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
        linkInto(workDir, dependency, installed);
    }
    mkdirSync(join(modules, '.bin'), { recursive: true });
    for (const [command, target] of Object.entries(manifest.bin)) {
        const link = join(modules, '.bin', command);
        refuseUnusableAncestor(name, workDir, link);
        rmSync(link, { force: true });
        symlinkSync(relative(join(modules, '.bin'), join(destination, target)), link);
    }
}
