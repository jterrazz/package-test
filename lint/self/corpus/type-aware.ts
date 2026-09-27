import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Linted in a scratch project extending this repository's tsconfig, so the matcher augmentation is the one a consumer compiles against. */

export type TypeAwareFinding = { line: number; rule: string };

/** oxlint's `unix` line. */
const UNIX_LINE = /^[^:]+:(?<line>\d+):\d+: .* \[\w+\/(?<plugin>[\w-]+)\((?<rule>[\w-]+)\)\]$/u;

/** Hoisted to the repository's `.bin`, or nested under the toolchain. */
function oxlintBinary(root: string): string {
    const hoisted = resolve(root, 'node_modules/.bin/oxlint');
    return existsSync(hoisted)
        ? hoisted
        : resolve(root, 'node_modules/@jterrazz/typescript/node_modules/.bin/oxlint');
}

export function typeAwareFindings(options: {
    cacheDir: string;
    root: string;
    rules: readonly string[];
    source: string;
}): TypeAwareFinding[] {
    const { cacheDir, root, rules, source } = options;
    const dir = mkdtempSync(join(cacheDir, 'type-aware-'));
    try {
        writeFileSync(join(dir, 'scratch.ts'), source);
        writeFileSync(
            join(dir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: { noEmit: true },
                extends: resolve(root, 'tsconfig.json'),
                include: ['scratch.ts'],
            }),
        );
        writeFileSync(
            join(dir, '.oxlintrc.json'),
            JSON.stringify({ plugins: ['typescript', 'vitest'] }),
        );
        const run = spawnSync(
            oxlintBinary(root),
            [
                '--type-aware',
                '--format=unix',
                '-c',
                '.oxlintrc.json',
                '-A',
                'all',
                ...rules.flatMap((rule) => ['-D', rule]),
                'scratch.ts',
            ],
            { cwd: dir, encoding: 'utf8' },
        );
        return run.stdout.split('\n').flatMap((text) => {
            const groups = UNIX_LINE.exec(text)?.groups;
            return groups?.line === undefined
                ? []
                : [{ line: Number(groups.line), rule: `${groups.plugin}/${groups.rule}` }];
        });
    } finally {
        rmSync(dir, { force: true, recursive: true });
    }
}
