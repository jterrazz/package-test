import { OXLINT_CONFIG_NAMES } from '@jterrazz/typescript/rules';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';

import {
    applyOwnFixes,
    nestedConfigDirectories,
    OWN_FIXES_WRAPPER,
    ownFixesConfig,
} from '../own-fixes.js';
import { disarmed, off, projectWith, stubOxlint } from './own-fixes.fixtures.js';

describe('own-fixes', () => {
    test("own-fixes — the wrapper arms the plugin's rules alone, in the base and in every override", async () => {
        // Given - a base config arming the plugin beside another rulebook, in its rules and an override
        const root = projectWith({
            'oxlint.config.mjs': [
                'export default {',
                "    jsPlugins: ['./dist/oxlint.js'],",
                "    options: { reportUnusedDisableDirectives: 'error', typeAware: true },",
                "    overrides: [{ files: ['specs/**'], rules: { 'jterrazz/one-describe-per-file': 'error', 'vitest/prefer-called-with': 'error' } }],",
                "    rules: { 'jterrazz/given-in-the-test': 'warn', 'unicorn/no-useless-undefined': 'error' },",
                '};',
            ].join('\n'),
        });
        const wrapper = join(root, 'wrapper.mjs');
        writeFileSync(wrapper, ownFixesConfig(join(root, 'oxlint.config.mjs')));

        // Then - only `jterrazz/*` survives, every category is off, and the run reads no type
        const module: unknown = await import(pathToFileURL(wrapper).href);
        expect(module).toHaveProperty('default', {
            categories: off,
            jsPlugins: ['./dist/oxlint.js'],
            options: disarmed,
            overrides: [
                { files: ['specs/**'], rules: { 'jterrazz/one-describe-per-file': 'error' } },
            ],
            rules: { 'jterrazz/given-in-the-test': 'warn' },
        });
    });

    test('own-fixes — the wrapper carries `extends`, arming the plugin alone in every config extended', async () => {
        // Given - the cap01 shape: a root arming the plugin only through an extended object, which extends a JSON file
        const root = projectWith({
            'base/base.json':
                '{ "jsPlugins": ["./plugin.js"], "rules": { "jterrazz/one-describe-per-file": "error", "no-debugger": "error" } }\n',
            'oxlint.config.mjs': [
                'export default {',
                '    extends: [{',
                "        extends: ['./base/base.json'],",
                "        jsPlugins: ['@jterrazz/test/oxlint'],",
                '        options: { typeAware: true },',
                "        rules: { 'jterrazz/given-in-the-test': 'warn', 'unicorn/no-useless-undefined': 'error' },",
                '    }],',
                "    ignorePatterns: ['.react-router/**'],",
                '};',
            ].join('\n'),
        });
        const wrapper = join(root, 'wrapper.mjs');
        writeFileSync(wrapper, ownFixesConfig(join(root, 'oxlint.config.mjs')));

        // Then - each extended config keeps its plugins and the plugin's rules alone, the JSON's plugin found from its folder
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
                            rules: { 'jterrazz/one-describe-per-file': 'error' },
                        },
                    ],
                    jsPlugins: ['@jterrazz/test/oxlint'],
                    options: disarmed,
                    overrides: [],
                    rules: { 'jterrazz/given-in-the-test': 'warn' },
                },
            ],
            ignorePatterns: ['.react-router/**'],
            options: disarmed,
            overrides: [],
            rules: {},
        });
    });

    test('own-fixes — a JSON config and every JSON it extends are read as oxlint reads them, comments and trailing commas allowed', async () => {
        // Given - a commented `.oxlintrc.json` extending a commented JSON, whose override arms a plugin of its folder
        const root = projectWith({
            '.oxlintrc.json':
                '// The project config.\n{ "extends": ["./base/base.json"], /* shared */ "rules": { "jterrazz/given-in-the-test": "warn", "no-debugger": "error", }, }\n',
            'base/base.json': [
                '{',
                '    // A string is never a comment: "a // b" and "/* c */" stay whole.',
                '    "overrides": [',
                String.raw`        { "files": ["a // b", "/* c */", "d\\"], "jsPlugins": ["./plugin.js"], "rules": { "jterrazz/one-describe-per-file": "error", }, },`,
                '    ],',
                '}',
            ].join('\n'),
        });
        const wrapper = join(root, 'wrapper.mjs');
        writeFileSync(wrapper, ownFixesConfig(join(root, '.oxlintrc.json')));

        // Then - both parse, the override keeps its files whole and finds its plugin from its folder
        const module: unknown = await import(pathToFileURL(wrapper).href);
        expect(module).toHaveProperty('default', {
            categories: off,
            extends: [
                {
                    categories: off,
                    options: disarmed,
                    overrides: [
                        {
                            files: ['a // b', '/* c */', 'd\\'],
                            jsPlugins: [join(root, 'base', 'plugin.js')],
                            rules: { 'jterrazz/one-describe-per-file': 'error' },
                        },
                    ],
                    rules: {},
                },
            ],
            options: disarmed,
            overrides: [],
            rules: { 'jterrazz/given-in-the-test': 'warn' },
        });
    });

    test('own-fixes — a `.jsonc` config is read, never imported', async () => {
        // Given - a root config written as `.oxlintrc.jsonc`, which Node refuses to import
        const root = projectWith({
            '.oxlintrc.jsonc':
                '{ /* armed */ "rules": { "jterrazz/given-in-the-test": "warn" } }\n',
        });
        const wrapper = join(root, 'wrapper.mjs');
        writeFileSync(wrapper, ownFixesConfig(join(root, '.oxlintrc.jsonc')));

        // Then - the wrapper loads, and arms the plugin's rule
        const module: unknown = await import(pathToFileURL(wrapper).href);
        expect(module).toHaveProperty('default.rules', { 'jterrazz/given-in-the-test': 'warn' });
    });

    test.each(OXLINT_CONFIG_NAMES)(
        'ratchet-own-fixes — fixes under the wrapper of a root `%s`, then deletes it',
        (name) => {
            // Given - a root config under a name the toolchain lists, and an oxlint leaving diagnostics (exit 1)
            const root = projectWith({ [name]: '{}\n' });
            stubOxlint(root, 1);

            // When - the pass runs
            applyOwnFixes(root);

            // Then - the fix ran by the wrapper around that config, which is gone
            expect(readFileSync(join(root, 'args.txt'), 'utf8')).toBe(
                `--fix -c ${OWN_FIXES_WRAPPER} --ignore-pattern ${OWN_FIXES_WRAPPER}\n`,
            );
            const wrapped = ownFixesConfig(join(root, name));
            expect(readFileSync(join(root, 'wrapper.mjs'), 'utf8')).toBe(wrapped);
            expect(existsSync(join(root, OWN_FIXES_WRAPPER))).toBe(false);
        },
    );

    test('own-fixes — every subtree under a nested oxlint config is fixed by a run of its own, under its own config', () => {
        // Given - a nested config at sub/, another inside it, one under a skipped folder, one oxlint never nests
        const root = projectWith({
            'loose/oxlint.config.mjs': 'export default {};\n',
            'node_modules/pkg/oxlint.config.ts': 'export default {};\n',
            'oxlint.config.ts': 'export default {};\n',
            'plain/index.ts': 'export {};\n',
            'plain/inner/oxlint.config.ts': 'export default {};\n',
            'specs/cli/__fixtures__/project/.oxlintrc.json': '{}\n',
            'sub/deeper/.oxlintrc.json': '{}\n',
            'sub/oxlint.config.ts': 'export default {};\n',
        });
        stubOxlint(root, 0);

        // When - the pass runs
        applyOwnFixes(root);

        // Then - the root's run ignores sub/, whose own run ignores deeper/, whose own run ignores nothing
        const real = realpathSync(root);
        expect(nestedConfigDirectories(root)).toStrictEqual(['plain/inner', 'sub']);
        expect(readFileSync(join(root, 'cwds.txt'), 'utf8')).toBe(
            [
                real,
                join(real, 'plain', 'inner'),
                join(real, 'sub'),
                join(real, 'sub', 'deeper'),
                '',
            ].join('\n'),
        );
        expect(readFileSync(join(root, 'args.txt'), 'utf8')).toBe(
            [
                `--fix -c ${OWN_FIXES_WRAPPER} --ignore-pattern ${OWN_FIXES_WRAPPER} --ignore-pattern plain/inner/** --ignore-pattern sub/**`,
                `--fix -c ${OWN_FIXES_WRAPPER} --ignore-pattern ${OWN_FIXES_WRAPPER}`,
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

    test('own-fixes — a folder git ignores is never entered, so a config below a seal that ignores its clones is never loaded', () => {
        // Given - a git repository whose sealed work/ ignores the clones under it, one of them and one ignored folder holding a config that throws on load
        const broken = "throw new Error('loaded');\n";
        const root = projectWith({
            '.gitignore': 'ignored/\nnode_modules/\nargs.txt\ncwds.txt\n',
            'ignored/oxlint.config.ts': broken,
            'oxlint.config.mjs': 'export default {};\n',
            'work/.gitignore': 'repositories\n',
            'work/.oxlintrc.json': '{}\n',
            'work/repositories/clone/oxlint.config.ts': broken,
            'work/repositories/clone/package.json': '{}\n',
        });
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        stubOxlint(
            root,
            1,
            `node --input-type=module -e "await import('./${OWN_FIXES_WRAPPER}')" 2>/dev/null || echo 'Failed to load config'`,
        );

        // When - the pass runs
        applyOwnFixes(root);

        // Then - the seal gets a run of its own, and nothing beneath it or in the ignored folder is reached
        expect(nestedConfigDirectories(root)).toStrictEqual(['work']);
        expect(readFileSync(join(root, 'cwds.txt'), 'utf8')).toBe(
            [realpathSync(root), join(realpathSync(root), 'work'), ''].join('\n'),
        );
    });

    test('own-fixes — an oxlint that could not run is a failure naming the binary, and leaves no wrapper', () => {
        // Given - an oxlint exiting past 1
        const root = projectWith({ '.oxlintrc.json': '{}\n' });
        stubOxlint(root, 2);
        const killed = projectWith({ '.oxlintrc.json': '{}\n' });
        stubOxlint(killed, 0, 'kill -9 $$');

        // Then - the pass throws with its stderr, and the wrapper is deleted; a killed oxlint fails alike
        expect(() => {
            applyOwnFixes(root);
        }).toThrow(`the checker ran ${join(root, 'node_modules', '.bin', 'oxlint')} --fix`);
        expect(() => {
            applyOwnFixes(killed);
        }).toThrow('and it failed');
        expect(existsSync(join(root, OWN_FIXES_WRAPPER))).toBe(false);
    });

    test('own-fixes — a config oxlint could not load is a failure naming it, though oxlint exits 1', () => {
        // Given - an oxlint that prints its load failure on stdout, under a report prefix, and exits 1, as it does
        const root = projectWith({ '.oxlintrc.json': '{}\n' });
        stubOxlint(root, 1, "echo '  x Failed to parse oxlint configuration file.'");

        // Then - the pass throws naming the config, and the wrapper is deleted
        expect(() => {
            applyOwnFixes(root);
        }).toThrow(`could not load the wrapper of ${join(root, '.oxlintrc.json')}`);
        expect(existsSync(join(root, OWN_FIXES_WRAPPER))).toBe(false);
    });

    test('own-fixes — a subtree under a `.oxlintrc.jsonc` is fixed under a wrapper that loads', () => {
        // Given - a commented nested `.jsonc`, and an oxlint that loads the wrapper it is handed as oxlint does
        const root = projectWith({
            'oxlint.config.ts': 'export default {};\n',
            'web/.oxlintrc.jsonc': '{\n    // web\'s own rulebook\n    "rules": {},\n}\n',
        });
        stubOxlint(
            root,
            1,
            `node --input-type=module -e "await import('./${OWN_FIXES_WRAPPER}')" 2>/dev/null || echo 'Failed to load config'`,
        );

        // Then - both runs load their wrapper, so the pass completes
        applyOwnFixes(root);
        expect(readFileSync(join(root, 'cwds.txt'), 'utf8')).toBe(
            [realpathSync(root), join(realpathSync(root), 'web'), ''].join('\n'),
        );
    });

    test('own-fixes — a project with no oxlint, or no root config, has nothing to fix', () => {
        // Given - one project with a config and no oxlint, one with an oxlint and no config
        const bare = projectWith({ 'oxlint.config.ts': 'export default {};\n' });
        const unconfigured = projectWith({ 'package.json': '{}\n' });
        stubOxlint(unconfigured, 2);

        // Then - neither runs anything
        applyOwnFixes(bare);
        applyOwnFixes(unconfigured);
        expect(existsSync(join(unconfigured, 'args.txt'))).toBe(false);
    });

    test('own-fixes — the suppressions oxlint rewrites are put back as they were, or left absent, and a long report is read whole', () => {
        // Given - an oxlint rewriting the suppressions file and printing a long report, under a project that held one and one that held none
        const script =
            "echo '{\"rewritten\":true}' > oxlint-suppressions.json\nprintf '%2000s\\n' report";
        const held = projectWith({
            '.oxlintrc.json': '{}\n',
            'oxlint-suppressions.json': '{"held":true}\n',
        });
        stubOxlint(held, 1, script);
        const none = projectWith({ '.oxlintrc.json': '{}\n' });
        stubOxlint(none, 1, script);

        // When - the pass runs on both
        applyOwnFixes(held);
        applyOwnFixes(none);

        // Then - the held file back, and none left where none was
        expect([
            readFileSync(join(held, 'oxlint-suppressions.json'), 'utf8'),
            existsSync(join(none, 'oxlint-suppressions.json')),
        ]).toStrictEqual(['{"held":true}\n', false]);
    });
});
