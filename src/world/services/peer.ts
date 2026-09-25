import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { findRoot } from '../../kernel/files/resolve.js';

/** The lockfile each package manager leaves, and the install command its user types. */
const INSTALLERS = [
    { command: 'bun add -d', lockfile: 'bun.lock', name: 'bun' },
    { command: 'bun add -d', lockfile: 'bun.lockb', name: 'bun' },
    { command: 'pnpm add -D', lockfile: 'pnpm-lock.yaml', name: 'pnpm' },
    { command: 'yarn add -D', lockfile: 'yarn.lock', name: 'yarn' },
    { command: 'npm install -D', lockfile: 'package-lock.json', name: 'npm' },
] as const;

const DEFAULT_INSTALLER = { command: 'npm install -D', name: 'npm' } as const;

/** Every manager withholds install scripts by default (npm 11, pnpm 10, bun 1.2): installing the package does not build it. */
const BUILDERS: Record<string, (peer: string) => string> = {
    bun: (peer) => `bun pm trust ${peer}`,
    npm: (peer) => `npm install-scripts approve ${peer} && npm rebuild ${peer}`,
    pnpm: (peer) =>
        `add "${peer}" to \`onlyBuiltDependencies\` in package.json` +
        ` (or \`only-built-dependencies\` in .npmrc), then \`pnpm rebuild ${peer}\``,
    yarn: (peer) => `yarn rebuild ${peer}`,
};

/** Node's message for a missing `.node`, the `bindings` package's, and the two shapes a binding built elsewhere produces. */
const UNBUILT =
    /could not locate the bindings file|\.node['"]?$|invalid elf header|was compiled against a different node/iu;

function isUnbuilt(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return UNBUILT.test(message);
}

const NATIVE_PEERS = new Set(['better-sqlite3']);

export function installerAt(from: string): { command: string; name: string } {
    const root = findRoot(from, existsSync);
    if (root === undefined) {
        return DEFAULT_INSTALLER;
    }
    return (
        INSTALLERS.find((candidate) => existsSync(resolve(root, candidate.lockfile))) ??
        DEFAULT_INSTALLER
    );
}

function buildNote(peer: string, manager: string): string {
    if (!NATIVE_PEERS.has(peer) || manager !== 'pnpm') {
        return '';
    }
    return (
        ` Under pnpm the binding is not built unless the package is listed:` +
        ` add "${peer}" to \`onlyBuiltDependencies\` in package.json` +
        ` (or \`only-built-dependencies\` in .npmrc) and reinstall.`
    );
}

/** A binding the package manager never built surfaces as a `bindings` stack trace; this turns it into a refusal naming the peer and the command. */
export function requireBuiltPeer(peer: string, what: string, use: () => void): void {
    try {
        use();
    } catch (error) {
        if (!isUnbuilt(error)) {
            throw error;
        }
        const { name } = installerAt(process.cwd());
        const build = (BUILDERS[name] ?? BUILDERS.npm)?.(peer) ?? `rebuild ${peer}`;
        throw new Error(
            `${what} found \`${peer}\` but its native binding is not built —` +
                ` ${name} does not run a dependency's install script unless it is told to: ${build}.`,
            { cause: error },
        );
    }
}

/** `load` is the caller's own `import('<peer>')`: the bundler and the resolver need to see the bare specifier. */
export async function loadPeer<T>(peer: string, what: string, load: () => Promise<T>): Promise<T> {
    try {
        return await load();
    } catch (error) {
        const { command, name } = installerAt(process.cwd());
        throw new Error(
            `${what} requires \`${peer}\`, an optional peer dependency of @jterrazz/test:` +
                ` ${command} ${peer}.${buildNote(peer, name)}`,
            { cause: error },
        );
    }
}
