import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Loading an OPTIONAL peer, and saying the right thing when it is not there.
 *
 * Four native seams — `better-sqlite3`, `pg`, `redis`, `testcontainers` — are
 * peers rather than dependencies: a consumer that specifies a CLI has no
 * business compiling a SQLite binding, and a package carrying all four would
 * make every install pay for the services one repository happens to use.
 *
 * A peer being absent is then an ordinary state, and the message is what turns
 * it into a one-line fix. Two things make it actionable:
 *
 * - it names the FACET that asked, so the reader knows which line to look at,
 *   and the peer to install, with the command of the package manager the
 *   project's own lockfile names — `npm install -D` in a Bun workspace is a
 *   line the reader has to translate before they can use it;
 * - under pnpm it names `only-built-dependencies` as well. pnpm does not run a
 *   dependency's install script unless the manifest lists it, so a native
 *   binding installs and then fails to LOAD — the one failure where "install
 *   the package" is advice the reader has already followed.
 */

/**
 * The lockfile each package manager leaves at the project root, and the
 * command a reader of this message types.
 *
 * A message that says `npm install` in a Bun workspace is a message the reader
 * has to translate before they can use it — and the translation is the only
 * part of the fix they did not already know.
 */
const INSTALLERS = [
    { command: 'bun add -d', lockfile: 'bun.lock', name: 'bun' },
    { command: 'bun add -d', lockfile: 'bun.lockb', name: 'bun' },
    { command: 'pnpm add -D', lockfile: 'pnpm-lock.yaml', name: 'pnpm' },
    { command: 'yarn add -D', lockfile: 'yarn.lock', name: 'yarn' },
    { command: 'npm install -D', lockfile: 'package-lock.json', name: 'npm' },
] as const;

/** What npm's absence of a lockfile still answers. */
const DEFAULT_INSTALLER = { command: 'npm install -D', name: 'npm' } as const;

/** The peers whose install script has to run for the package to load at all. */
const NATIVE_PEERS = new Set(['better-sqlite3']);

/** The nearest ancestor of `from` carrying a `package.json`, or undefined. */
function projectRoot(from: string): string | undefined {
    let directory = from;
    for (;;) {
        if (existsSync(resolve(directory, 'package.json'))) {
            return directory;
        }
        const parent = dirname(directory);
        if (parent === directory) {
            return undefined;
        }
        directory = parent;
    }
}

/**
 * The package manager a project is installed by, read from its lockfile.
 *
 * Exported for its own module test: the answer depends on the filesystem
 * around the caller, which a test states by building one.
 *
 * @internal
 */
export function installerAt(from: string): { command: string; name: string } {
    const root = projectRoot(from);
    if (root === undefined) {
        return DEFAULT_INSTALLER;
    }
    return (
        INSTALLERS.find((candidate) => existsSync(resolve(root, candidate.lockfile))) ??
        DEFAULT_INSTALLER
    );
}

/** The line a reader has to add, when the package manager needs one. */
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

/**
 * Import an optional peer, or throw a message that names the facet, the peer
 * and the command.
 *
 * `load` is the caller's own `import('<peer>')`: a bare specifier is what the
 * bundler and the resolver both need to see, so the import stays at the call
 * site and this function owns only the failure.
 */
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
