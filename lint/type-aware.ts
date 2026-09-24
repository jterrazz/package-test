import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * What a type-aware rule of the toolchain says about a source typed by this
 * package — for a convention the plugin hands to one of them rather than
 * holding it itself.
 *
 * The source is linted in a scratch project that extends the repository's own
 * tsconfig, so the matcher augmentation it imports is the one a consumer
 * compiles against; oxlint runs with `--type-aware` and the named rules alone.
 */

/** One finding: its line, and the rule that made it. */
export type TypeAwareFinding = { line: number; rule: string };

/** `<file>:<line>:<col>: <message> [<Severity>/<plugin>(<rule>)]`, oxlint's `unix` line. */
const UNIX_LINE = /^[^:]+:(?<line>\d+):\d+: .* \[\w+\/(?<plugin>[\w-]+)\((?<rule>[\w-]+)\)\]$/u;

/** The oxlint binary: hoisted to the repository's `.bin`, or nested under the toolchain. */
function oxlintBinary(root: string): string {
    const hoisted = resolve(root, 'node_modules/.bin/oxlint');
    return existsSync(hoisted)
        ? hoisted
        : resolve(root, 'node_modules/@jterrazz/typescript/node_modules/.bin/oxlint');
}

/**
 * The findings `rules` make on `source`, linted type-aware in a scratch project
 * under `cacheDir` that extends `root`'s tsconfig.
 */
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
        writeFileSync(join(dir, '.oxlintrc.json'), '{}');
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
