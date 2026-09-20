import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Loading an OPTIONAL peer, and saying the right thing when it is not there.
 *
 * Four native seams — `better-sqlite3`, `pg`, `redis`, `testcontainers` — are
 * peers rather than dependencies from 16.0: a consumer that specifies a CLI has
 * no business compiling a SQLite binding, and a package that carried all four
 * made every install pay for the services one repository happened to use.
 *
 * A peer being absent is then an ordinary state, and the message is what turns
 * it into a one-line fix. Two things make it actionable:
 *
 * - it names the FACET that asked, so the reader knows which line to look at,
 *   and the peer to install, with the command;
 * - under pnpm it names `only-built-dependencies` as well. pnpm does not run a
 *   dependency's install script unless the manifest lists it, so a native
 *   binding installs and then fails to LOAD — the one failure where "install
 *   the package" is advice the reader has already followed.
 */

/** A pnpm lockfile at the project root is how the package manager announces itself. */
const PNPM_LOCK = 'pnpm-lock.yaml';

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

/** Is this project installed by pnpm? */
function underPnpm(): boolean {
    const root = projectRoot(process.cwd());
    return root !== undefined && existsSync(resolve(root, PNPM_LOCK));
}

/** The line a reader has to add, when the package manager needs one. */
function buildNote(peer: string): string {
    if (!NATIVE_PEERS.has(peer) || !underPnpm()) {
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
        throw new Error(
            `${what} requires \`${peer}\`, an optional peer dependency of @jterrazz/test:` +
                ` npm install -D ${peer}.${buildNote(peer)}`,
            { cause: error },
        );
    }
}
