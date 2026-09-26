import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** `RuleTester` comes from `oxlint/plugins-dev`, so oxlint must be a declared devDependency; `@jterrazz/typescript` owns the pin, and `oxlint-pin.test.ts` fails on any divergence. */

type Manifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
};

/** An unreadable or malformed one states no range at all. */
function manifestAt(path: string): Manifest {
    try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: this names the three blocks the readers below take a range from, and a manifest without them answers `undefined`
        return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
    } catch {
        return {};
    }
}

export function declaredRange(root: string): string | undefined {
    return manifestAt(resolve(root, 'package.json')).devDependencies?.oxlint;
}

export function toolchainRange(root: string): string | undefined {
    const toolchain = manifestAt(resolve(root, 'node_modules/@jterrazz/typescript/package.json'));
    return toolchain.dependencies?.oxlint ?? toolchain.peerDependencies?.oxlint;
}
