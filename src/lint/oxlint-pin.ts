import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The oxlint version this repository declares, and the one the toolchain pins.
 *
 * `oxlint/plugins-dev` ships `RuleTester`, which every rule test stands on, so
 * the specifier has to be a DECLARED devDependency: a specifier a test imports
 * and no manifest names resolves only where an ancestor `node_modules` happens
 * to carry it, and a plain `npm ci` clone collects nothing.
 *
 * The pin's owner is `@jterrazz/typescript` — oxlint is the binary IT runs, and
 * a project holding a second opinion about its own toolchain is the drift
 * `docs/19-linting.md` warns about. The line here MIRRORS that one, which is
 * why it is not free to move: `oxlint-pin.test.ts` fails on any divergence.
 */

/** The dependency blocks of a manifest a range may be stated in. */
type Manifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
};

/** A manifest, by path. An unreadable or malformed one states no range at all. */
function manifestAt(path: string): Manifest {
    try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: this names the three blocks the readers below take a range from, and a manifest without them answers `undefined`
        return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
    } catch {
        return {};
    }
}

/** The range this package's own `devDependencies` states for oxlint. */
export function declaredRange(root: string): string | undefined {
    return manifestAt(resolve(root, 'package.json')).devDependencies?.oxlint;
}

/** The range `@jterrazz/typescript` pins, read from the install itself. */
export function toolchainRange(root: string): string | undefined {
    const toolchain = manifestAt(resolve(root, 'node_modules/@jterrazz/typescript/package.json'));
    return toolchain.dependencies?.oxlint ?? toolchain.peerDependencies?.oxlint;
}
