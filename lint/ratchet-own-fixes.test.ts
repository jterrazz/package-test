import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';

import {
    applyOwnFixes,
    nestedConfigDirectories,
    OWN_FIXES_WRAPPER,
    ownFixesConfig,
} from './ratchet-own-fixes.js';

/** A project root holding `files`, each written as given. */
function projectWith(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'own-fixes-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

/** A stub oxlint that appends its arguments and the folder it ran in, copies the wrapper it was handed, then exits `status`. */
function stubOxlint(root: string, status: number): void {
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    const bin = join(root, 'node_modules', '.bin', 'oxlint');
    writeFileSync(
        bin,
        `#!/bin/sh\necho "$@" >> "${root}/args.txt"\npwd -P >> "${root}/cwds.txt"\ncp ${OWN_FIXES_WRAPPER} wrapper.mjs\necho "cannot run" >&2\nexit ${status}\n`,
    );
    chmodSync(bin, 0o755);
}

describe('the checker’s own fix pass — the plugin’s fixers, and no one else’s', () => {
    test("the wrapper arms the plugin's rules alone, in the base and in every override", async () => {
        // Given - a base config arming the plugin beside another rulebook, in its rules and an override
        const root = projectWith({
            'oxlint.config.mjs': [
                'export default {',
                "    jsPlugins: ['./dist/oxlint.js'],",
                "    options: { reportUnusedDisableDirectives: 'error', typeAware: true },",
                "    overrides: [{ files: ['specs/**'], rules: { 'jterrazz/c31-describe-names-file': 'error', 'vitest/prefer-called-with': 'error' } }],",
                "    rules: { 'jterrazz/b16w-file-context': 'warn', 'unicorn/no-useless-undefined': 'error' },",
                '};',
            ].join('\n'),
        });
        const wrapper = join(root, 'wrapper.mjs');
        writeFileSync(wrapper, ownFixesConfig(join(root, 'oxlint.config.mjs')));

        // Then - only `jterrazz/*` survives, every category is off, and the run reads no type
        const module: unknown = await import(pathToFileURL(wrapper).href);
        expect(module).toHaveProperty('default', {
            categories: {
                correctness: 'off',
                nursery: 'off',
                pedantic: 'off',
                perf: 'off',
                restriction: 'off',
                style: 'off',
                suspicious: 'off',
            },
            jsPlugins: ['./dist/oxlint.js'],
            options: { reportUnusedDisableDirectives: 'off', typeAware: false },
            overrides: [
                { files: ['specs/**'], rules: { 'jterrazz/c31-describe-names-file': 'error' } },
            ],
            rules: { 'jterrazz/b16w-file-context': 'warn' },
        });
    });

    test('the wrapper carries `extends`, arming the plugin alone in every config extended', async () => {
        // Given - the cap01 shape: a root arming the plugin only through an extended object, which extends a JSON file
        const root = projectWith({
            'base/base.json':
                '{ "jsPlugins": ["./plugin.js"], "rules": { "jterrazz/c31-describe-names-file": "error", "no-debugger": "error" } }\n',
            'oxlint.config.mjs': [
                'export default {',
                '    extends: [{',
                "        extends: ['./base/base.json'],",
                "        jsPlugins: ['@jterrazz/test/oxlint'],",
                '        options: { typeAware: true },',
                "        rules: { 'jterrazz/b16w-file-context': 'warn', 'unicorn/no-useless-undefined': 'error' },",
                '    }],',
                "    ignorePatterns: ['.react-router/**'],",
                '};',
            ].join('\n'),
        });
        const wrapper = join(root, 'wrapper.mjs');
        writeFileSync(wrapper, ownFixesConfig(join(root, 'oxlint.config.mjs')));

        // Then - each extended config keeps its plugins and the plugin's rules alone, the JSON's plugin found from its folder
        const off = {
            correctness: 'off',
            nursery: 'off',
            pedantic: 'off',
            perf: 'off',
            restriction: 'off',
            style: 'off',
            suspicious: 'off',
        };
        const disarmed = { reportUnusedDisableDirectives: 'off', typeAware: false };
        const module: unknown = await import(pathToFileURL(wrapper).href);
        expect(module).toHaveProperty('default', {
            categories: off,
            extends: [
                {
                    categories: off,
                    extends: [
                        {
                            categories: off,
                            jsPlugins: [join(root, 'base', 'plugin.js')],
                            options: disarmed,
                            overrides: [],
                            rules: { 'jterrazz/c31-describe-names-file': 'error' },
                        },
                    ],
                    jsPlugins: ['@jterrazz/test/oxlint'],
                    options: disarmed,
                    overrides: [],
                    rules: { 'jterrazz/b16w-file-context': 'warn' },
                },
            ],
            ignorePatterns: ['.react-router/**'],
            options: disarmed,
            overrides: [],
            rules: {},
        });
    });

    test('a JSON config is imported as JSON', () => {
        // Given - a root config written as `.oxlintrc.json`
        // Then - the import carries its type attribute
        expect(ownFixesConfig('/project/.oxlintrc.json').split('\n')).toContain(
            'import base from "/project/.oxlintrc.json" with { type: \'json\' };',
        );
    });

    test('runs the project oxlint with --fix under the wrapper, then deletes it', () => {
        // Given - a project with a root config and an oxlint that leaves diagnostics (exit 1)
        const root = projectWith({ 'oxlint.config.ts': 'export default {};\n' });
        stubOxlint(root, 1);

        // When - the pass runs
        applyOwnFixes(root);

        // Then - the fix ran by the wrapper around the root config, which is gone
        expect(readFileSync(join(root, 'args.txt'), 'utf8')).toBe(
            `--fix -c ${OWN_FIXES_WRAPPER} --ignore-pattern ${OWN_FIXES_WRAPPER}\n`,
        );
        expect(readFileSync(join(root, 'wrapper.mjs'), 'utf8')).toBe(
            ownFixesConfig(join(root, 'oxlint.config.ts')),
        );
        expect(existsSync(join(root, OWN_FIXES_WRAPPER))).toBe(false);
    });

    test('every subtree under a nested oxlint config is fixed by a run of its own, under its own config', () => {
        // Given - a nested config at sub/, another inside it, one under a skipped folder, one oxlint never nests
        const root = projectWith({
            'loose/oxlint.config.mjs': 'export default {};\n',
            'node_modules/pkg/oxlint.config.ts': 'export default {};\n',
            'oxlint.config.ts': 'export default {};\n',
            'plain/index.ts': 'export {};\n',
            'specs/cli/fixtures/project/.oxlintrc.json': '{}\n',
            'sub/deeper/.oxlintrc.json': '{}\n',
            'sub/oxlint.config.ts': 'export default {};\n',
        });
        stubOxlint(root, 0);

        // When - the pass runs
        applyOwnFixes(root);

        // Then - the root's run ignores sub/, whose own run ignores deeper/, whose own run ignores nothing
        const real = realpathSync(root);
        expect(nestedConfigDirectories(root)).toStrictEqual(['sub']);
        expect(readFileSync(join(root, 'cwds.txt'), 'utf8')).toBe(
            [real, join(real, 'sub'), join(real, 'sub', 'deeper'), ''].join('\n'),
        );
        expect(readFileSync(join(root, 'args.txt'), 'utf8')).toBe(
            [
                `--fix -c ${OWN_FIXES_WRAPPER} --ignore-pattern ${OWN_FIXES_WRAPPER} --ignore-pattern sub/**`,
                `--fix -c ${OWN_FIXES_WRAPPER} --ignore-pattern ${OWN_FIXES_WRAPPER} --ignore-pattern deeper/**`,
                `--fix -c ${OWN_FIXES_WRAPPER} --ignore-pattern ${OWN_FIXES_WRAPPER}`,
                '',
            ].join('\n'),
        );
        expect(readFileSync(join(root, 'sub', 'wrapper.mjs'), 'utf8')).toBe(
            ownFixesConfig(join(root, 'sub', 'oxlint.config.ts')),
        );
        expect(readFileSync(join(root, 'sub', 'deeper', 'wrapper.mjs'), 'utf8')).toBe(
            ownFixesConfig(join(root, 'sub', 'deeper', '.oxlintrc.json')),
        );
    });

    test('an oxlint that could not run is a failure naming the binary, and leaves no wrapper', () => {
        // Given - an oxlint exiting past 1
        const root = projectWith({ '.oxlintrc.json': '{}\n' });
        stubOxlint(root, 2);

        // Then - the pass throws with its stderr, and the wrapper is deleted
        expect(() => {
            applyOwnFixes(root);
        }).toThrow(`the checker ran ${join(root, 'node_modules', '.bin', 'oxlint')} --fix`);
        expect(existsSync(join(root, OWN_FIXES_WRAPPER))).toBe(false);
    });

    test('a project with no oxlint, or no root config, has nothing to fix', () => {
        // Given - one project with a config and no oxlint, one with an oxlint and no config
        const bare = projectWith({ 'oxlint.config.ts': 'export default {};\n' });
        const unconfigured = projectWith({ 'package.json': '{}\n' });
        stubOxlint(unconfigured, 2);

        // Then - neither runs anything
        applyOwnFixes(bare);
        applyOwnFixes(unconfigured);
        expect(existsSync(join(unconfigured, 'args.txt'))).toBe(false);
    });
});
