import { isDiskDirectory } from './spec-path.js';
import type { DiskDirectory } from './spec-path.js';

// invariant: a registry symbol, so every build of the package reads the same brand.
// Stryker disable next-line StringLiteral: any key names one brand, which every build of the package reads alike
const PACKED: unique symbol = Symbol.for('@jterrazz/test:packed');

/** The tarball `npm pack` writes for a package, laid as a consumer's install lays it. */
export type PackedPackage = {
    readonly [PACKED]: true;
    /** The package's directory, from the spec file; `null` is the project the spec belongs to. */
    readonly path: DiskDirectory['path'] | null;
};

/** Name the package a consumer installs: the project the spec belongs to, or the package a directory holds, packed as `npm pack` packs it. */
export function packed(source?: DiskDirectory): PackedPackage {
    return Object.freeze({
        [PACKED]: true as const,
        path: isDiskDirectory(source) ? source.path : null,
    });
}

export function isPackedPackage(value: unknown): value is PackedPackage {
    return value !== null && typeof value === 'object' && Reflect.get(value, PACKED) === true;
}
