import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { refusal } from '../../../chain/refusals/refusal.js';

const requireFrom = createRequire(import.meta.url);

export function versionOf(specifier: string): string {
    const manifest: unknown = JSON.parse(
        readFileSync(requireFrom.resolve(`${specifier}/package.json`), 'utf8'),
    );
    if (typeof manifest === 'object' && manifest !== null && 'version' in manifest) {
        return String(manifest.version);
    }
    throw new Error(
        refusal({
            fix: `reinstall ${specifier}: \`npm install ${specifier}\``,
            found: `the installed ${specifier} manifest carries no version`,
            read: 'docs/start/set-up-a-project.md#what-to-install',
            why: 'The component project reads the version of the peers it configures from their installed manifests.',
        }),
    );
}

/** Vite 8 transforms with oxc and warns on every `esbuild` option; Vite 6 and 7 have no `oxc` key. */
export function transformKey(): 'esbuild' | 'oxc' {
    return Number.parseInt(versionOf('vite').split('.')[0] ?? '', 10) >= 8 ? 'oxc' : 'esbuild';
}

/** `@vitest/browser-playwright` peers vitest on an exact version; a mismatch fails deep in the tester naming neither. */
export function assertProviderPin(runner: string, provider: null | string): void {
    if (provider === null) {
        throw new Error(
            refusal('seam-is-an-optional-peer', {
                fix: `npm i -D @vitest/browser-playwright@${runner} playwright`,
                found: 'component() requires `@vitest/browser-playwright`, and it is not installed',
            }),
        );
    }
    if (runner !== provider) {
        throw new Error(
            refusal({
                fix: `bump both to the same version in one change: npm i -D vitest@${provider} @vitest/browser-playwright@${provider}`,
                found: `component(): @vitest/browser-playwright is ${provider}, and vitest is ${runner}`,
                read: 'docs/start/set-up-a-project.md#what-to-install',
                why: '`@vitest/browser-playwright` peers vitest on an exact version.',
            }),
        );
    }
}

export function installedVersion(specifier: string): null | string {
    try {
        return versionOf(specifier);
    } catch {
        return null;
    }
}
