import type { Preset } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { resolveRoot } from '../../../lint/engine/project/resolve.js';
import { refusal } from '../../../lint/index.refusal.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import type { ChainConfig, Started } from '../../kernel/chain/config.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import type { LintSpecification } from './lint.facet.js';
import { lintFacet } from './lint.facet.js';
import type { LintPort } from './lint.port.js';
import { localLinters } from './local-linters.adapter.js';
import type { LintConfig } from './local-linters.adapter.js';

export type LintFacetConfig = ChainConfig & { linters?: LintPort | undefined };

/** Options for {@link startLint | specification.lint}; at least one linter — a plugin, a checker or a preset. */
export type LintSpecificationOptions = {
    /** Cross-file checkers, each a command printing a finding a line as `<file>:<line>:<column>: error <plugin>(<rule>): <message>`; `.run()` hands it the tree as its last argument. */
    checkers?: readonly string[];
    /** The oxlint config the plugins run under — `rules`, `settings`, `categories`, `overrides` — less `jsPlugins`, which `plugins` states. */
    config?: LintConfig;
    /** oxlint JS plugins, each a path from the specification's folder or a package specifier. */
    plugins?: readonly string[];
    /** `@jterrazz/typescript` presets whose laws run on the tree: the Architecture pass over their `layers`, the Names pass over their `names`. */
    presets?: readonly Preset[];
    /** Project root override — the plugins' specifiers and the checkers' commands resolve from its `node_modules`. */
    root?: string;
};

/** What `specification.lint()` returns: `const { lint, cleanup } = …` (`no-runner-alias`). */
export type LintHandle = {
    /** Nothing is started: kept so every constructor is released the same way. */
    cleanup: () => Promise<void>;
    lint: LintSpecification;
};

function pluginPath(plugin: string, callerDir: string, root: string): string {
    if (isAbsolute(plugin)) {
        return plugin;
    }
    if (plugin.startsWith('.')) {
        return resolve(callerDir, plugin);
    }
    try {
        return createRequire(join(root, 'package.json')).resolve(plugin);
    } catch {
        throw new Error(
            refusal({
                fix: `install ${plugin}, or name the plugin by its path from the specification's folder`,
                found: `plugins: ['${plugin}'], which resolves from no node_modules under ${root}`,
                read: 'docs/21-lint.md#options',
                why: 'A plugin is loaded by the oxlint the facet runs, from the path it resolves to.',
            }),
        );
    }
}

function binOf(manifest: string): null | string {
    const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
    const bin =
        typeof parsed === 'object' && parsed !== null && 'bin' in parsed ? parsed.bin : null;
    if (typeof bin === 'string') {
        return join(dirname(manifest), bin);
    }
    return typeof bin === 'object' &&
        bin !== null &&
        'oxlint' in bin &&
        typeof bin.oxlint === 'string'
        ? join(dirname(manifest), bin.oxlint)
        : null;
}

function oxlintBinary(root: string): null | string {
    for (const from of [join(root, 'package.json'), import.meta.filename]) {
        try {
            return binOf(createRequire(from).resolve('oxlint/package.json'));
        } catch {
            continue;
        }
    }
    return null;
}

export async function startLint(options: LintSpecificationOptions): Promise<LintHandle> {
    const callerDir = getCallerDir();
    await registerMatchers();
    const root = resolveRoot(options.root, callerDir);
    const plugins = (options.plugins ?? []).map((plugin) => pluginPath(plugin, callerDir, root));
    const checkers = options.checkers ?? [];
    const presets = options.presets ?? [];
    if (plugins.length === 0 && checkers.length === 0 && presets.length === 0) {
        throw new Error(
            refusal({
                fix: 'name the plugins, the checkers or the presets the specification lints with',
                found: 'specification.lint() with no plugin, no checker and no preset',
                read: 'docs/21-lint.md#options',
                why: 'A lint specification runs the linters it names, and one that names none judges nothing.',
            }),
        );
    }
    const oxlint = plugins.length === 0 ? null : oxlintBinary(root);
    if (plugins.length > 0 && oxlint === null) {
        throw new Error(
            refusal({
                fix: 'install oxlint — an optional peer of @jterrazz/test — beside the project',
                found: `specification.lint() with plugins, and no oxlint resolves from ${root}`,
                read: 'docs/21-lint.md#options',
                why: 'A plugin is run by the real oxlint, the one a project lints with.',
            }),
        );
    }
    const config: Started<LintFacetConfig, 'linters'> = {
        linters: localLinters({
            checkers,
            config: options.config ?? {},
            oxlint,
            plugins,
            presets,
            root,
        }),
        root,
    };
    return {
        cleanup: async () => {
            await Promise.resolve();
        },
        lint: lintFacet.open(config),
    };
}
