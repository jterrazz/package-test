import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isRecord } from '../../lint/kit/project/json-shape.js';
import { refusal } from '../chain/refusals/refusal.js';

export type Manifest = {
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
                found: `packed(): ${path} is no JSON: ${error instanceof Error ? error.message : String(error)}`,
                read: 'docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
                why: 'packed() reads the name, the bin and the runtime closure the package declares in its package.json.',
            }),
            { cause: error },
        );
    }
}

/** What `packed()` reads of a package's manifest: its name, the commands its `bin` lays, and what it requires at runtime; a manifest that is no JSON is refused. */
export function manifestAt(directory: string): Manifest {
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
