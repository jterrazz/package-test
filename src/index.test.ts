import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/** The repository root, from this module's place inside `src/`. */
const ROOT = resolve(import.meta.dirname, '..');

/** The node entry as a consumer installs it: `src/index.ts` built, where the manifest's `import` condition points. */
function builtEntry(): string {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: the one condition read here is the one the assertion below loads, and a wrong shape fails it
    const { exports } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        exports: { '.': { import: string } };
    };
    return resolve(ROOT, exports['.'].import);
}

/**
 * Loads the module named by its first argument and prints, one per line,
 * every package its graph resolved on the way.
 */
const PACKAGES_LOADED = `
import { registerHooks } from 'node:module';
const urls = new Set();
registerHooks({
    resolve(specifier, context, next) {
        const resolved = next(specifier, context);
        urls.add(resolved.url);
        return resolved;
    },
});
await import(process.argv[1]);
const names = new Set();
for (const url of urls) {
    const inside = url.split('/node_modules/').at(-1);
    if (inside !== url) {
        const parts = inside.split('/');
        names.add(parts[0].startsWith('@') ? parts[0] + '/' + parts[1] : parts[0]);
    }
}
process.stdout.write([...names].sort().join('\\n'));
`;

/** Every package loading `entry` reaches, in a node process of its own. */
function packagesLoadedBy(entry: string): string[] {
    return execFileSync(process.execPath, ['--input-type=module', '-e', PACKAGES_LOADED, entry], {
        encoding: 'utf8',
    }).split('\n');
}

describe('the node entry', () => {
    test('loads no engine a spec pays for only when it declares one', () => {
        // Given - the entry loaded in a fresh module graph
        const loaded = packagesLoadedBy(builtEntry());

        // Then - the network double's engine, the browser and the device driver stay behind their adapters' lazy imports
        expect(
            loaded.filter((name) => ['msw', 'playwright', 'webdriverio'].includes(name)),
        ).toStrictEqual([]);
    });
});
