import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { stringsAt } from '../../kit/project/json-shape.js';

/** `RuleTester` comes from `oxlint/plugins-dev`, so oxlint must be a declared devDependency; `@jterrazz/typescript` owns the pin, and `oxlint-pin.test.ts` fails on any divergence. */

/** An unreadable or malformed one states no range at all. */
function manifestAt(path: string): unknown {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return {};
    }
}

export function declaredRange(root: string): string | undefined {
    return stringsAt(manifestAt(resolve(root, 'package.json')), 'devDependencies').oxlint;
}

export function toolchainRange(root: string): string | undefined {
    const toolchain = manifestAt(resolve(root, 'node_modules/@jterrazz/typescript/package.json'));
    return (
        stringsAt(toolchain, 'dependencies').oxlint ??
        stringsAt(toolchain, 'peerDependencies').oxlint
    );
}
