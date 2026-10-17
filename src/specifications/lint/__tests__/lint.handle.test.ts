import { copyFileSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../../chain/paths/scratch.js';
import { directory } from '../../../disk/spec-path.js';
import { oxlintBinary, startLint } from '../lint.handle.js';

const project = (bin?: unknown, manifest?: unknown): string => {
    const root = scratchDirectory('lint-handle-project-');
    mkdirSync(join(root, 'node_modules/oxlint'), { recursive: true });
    writeFileSync(
        join(root, 'node_modules/oxlint/package.json'),
        JSON.stringify(manifest ?? { name: 'oxlint', ...(bin === undefined ? {} : { bin }) }),
    );
    return join(root, 'package.json');
};

const reportOf = async (options: Parameters<typeof startLint>[0]): Promise<string> => {
    const { lint } = await startLint(options);
    const result = await lint
        .rules({ 'acme/no-x': 'error' })
        .fixture(directory('./__fixtures__/tree/'))
        .run();
    return result.report.text;
};

const NO_DEBUGGER = { 'no-debugger': 'error' };

const rulesUnder = async (
    options: Parameters<typeof startLint>[0],
    rules: Record<string, string> = NO_DEBUGGER,
): Promise<string> => {
    try {
        const { lint } = await startLint(options);
        const result = await lint.rules(rules).fixture(directory('./__fixtures__/tree/')).run();
        return result.report.text;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
};

// outside: where a project's installed oxlint keeps a bin, as the resolver reaches it.
function installedBin(anchor: string, bin: string): string {
    const installed = realpathSync(join(anchor, '../node_modules/oxlint'));
    return join(installed, bin);
}

describe('lint.handle', () => {
    test('oxlintBinary — anchors no oxlint resolves from, or whose oxlint names no bin of its own — are refused before any tree is linted', () => {
        // Given - an anchor in a folder with no node_modules, and projects whose oxlint manifest is a list or names a bin that is no path
        const anchor = join(scratchDirectory('lint-handle-anchor-'), 'package.json');

        const odd = [project(undefined, []), project({ oxlint: 1 })];

        // Then - the refusal names every anchor it searched and the peer to install
        expect(() => oxlintBinary([anchor, ...odd])).toThrow(
            new Error(
                `found: specification.lint() runs oxlint, and none resolves from ${[anchor, ...odd].join(', ')}\nwhy: A plugin and a config are run by the real oxlint, the one a project lints with.\nfix: install oxlint, an optional peer of @jterrazz/test, beside the project\nread: docs/guides/lint-specs.md#options`,
            ),
        );
    });

    test('oxlintBinary — the bin of the first anchor oxlint resolves from, named as a path or under oxlint, past one it does not or that names no oxlint bin', () => {
        // Given - projects whose oxlint states its bin as a path, under its name, under another name, or not at all
        const empty = join(scratchDirectory('lint-handle-anchor-'), 'package.json');
        const [path, named, other, none] = [
            project('bin/ox.js'),
            project({ oxlint: 'bin/named.js' }),
            project({ oxfmt: 'x.js' }),
            project(),
        ];

        // Then - each binary found, the anchors without one passed over
        expect([oxlintBinary([empty, path]), oxlintBinary([other, none, named])]).toStrictEqual([
            installedBin(path, 'bin/ox.js'),
            installedBin(named, 'bin/named.js'),
        ]);
    });

    test('startLint — a plugin named by its path from the specification, an absolute one, or a package the project installed, runs under oxlint', async () => {
        // Given - the plugin by each name, the last installed in a project of its own
        const root = scratchDirectory('lint-handle-root-');
        mkdirSync(join(root, 'node_modules/acme-plugin'), { recursive: true });
        copyFileSync(
            join(import.meta.dirname, '__fixtures__/acme-plugin.js'),
            join(root, 'node_modules/acme-plugin/index.js'),
        );
        writeFileSync(
            join(root, 'node_modules/acme-plugin/package.json'),
            JSON.stringify({ main: 'index.js', name: 'acme-plugin', type: 'module' }),
        );

        // Then - the plugin's finding each time
        const finding = 'a.js:1:14  acme(no-x)\n    no x\n';
        expect([
            await reportOf({ plugins: ['./__fixtures__/acme-plugin.js'] }),
            await reportOf({ plugins: [join(import.meta.dirname, '__fixtures__/acme-plugin.js')] }),
            await reportOf({ plugins: ['acme-plugin'], root }),
        ]).toStrictEqual([finding, finding, finding]);
    });

    test('startLint — rules need oxlint: a config runs it, checkers alone do not, and a specification naming no linter is refused', async () => {
        // Given - a config alone, and checkers alone, both given the plugin's rule

        // Then - oxlint runs clean under the config, the checkers are refused the rule, and no linter is no specification
        const firstLines = [
            await rulesUnder({ config: {} }),
            await rulesUnder({ checkers: ['true'] }),
            await rulesUnder({}),
            await rulesUnder({ presets: [] }),
        ].map((text) => text.split('\n')[0]);
        expect(firstLines).toStrictEqual([
            '',
            'found: .rules() states no-debugger, and the specification runs no oxlint',
            'found: specification.lint() with no plugin, no config, no checker and no presets',
            'found: .rules() states no-debugger, and the specification runs no oxlint',
        ]);
    });

    test('startLint — refuses a plugin no node_modules resolves, and a specification naming no linter, whole; settings reach the presets', async () => {
        // Given - a plugin nothing installed, no linter at all, and presets under settings they cannot resolve
        const root = scratchDirectory('lint-handle-root-');
        const unresolved = await rulesUnder(
            { presets: [], settings: { typescript: { spine: null } } },
            {},
        );

        // Then - each refusal
        expect([
            await rulesUnder({ plugins: ['@acme/no-such-plugin'], root }, {}),
            await rulesUnder({}, {}),
            unresolved.split('\n')[0],
        ]).toStrictEqual([
            [
                `found: plugins: ['@acme/no-such-plugin'], which resolves from no node_modules under ${root}`,
                'why: A plugin is loaded by the oxlint the specification runs, from the path it resolves to.',
                "fix: install @acme/no-such-plugin, or name the plugin by its path from the specification's folder",
                'read: docs/guides/lint-specs.md#options',
            ].join('\n'),
            [
                'found: specification.lint() with no plugin, no config, no checker and no presets',
                'why: A lint specification runs the linters it names, and one that names none judges nothing.',
                'fix: name the plugins, the config, the checkers or the presets the specification lints with (`presets: []` for the base preset alone)',
                'read: docs/guides/lint-specs.md#options',
            ].join('\n'),
            "found: the presets' checks failed and reported no diagnostic: writes a single value at `typescript.spine`, where its presets set a list — a setting adds to a default, never replaces its shape",
        ]);
    });

    test("startLint — the oxlint run is the project's own, resolved from its root before the package's", async () => {
        // Given - a project whose oxlint is a stand-in reporting one finding of its own
        const root = scratchDirectory('lint-handle-root-');
        mkdirSync(join(root, 'node_modules/oxlint'), { recursive: true });
        writeFileSync(
            join(root, 'node_modules/oxlint/package.json'),
            JSON.stringify({ bin: 'bin.cjs', name: 'oxlint' }),
        );
        writeFileSync(
            join(root, 'node_modules/oxlint/bin.cjs'),
            "console.log('a.js:1:1: stand-in [Error/stand(in)]');\n",
        );

        // Then - the stand-in's finding is the report
        await expect(rulesUnder({ config: {}, root }, {})).resolves.toBe(
            'a.js:1:1  stand(in)\n    stand-in\n',
        );
    });
});
