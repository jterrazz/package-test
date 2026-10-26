import type { Preset } from '@jterrazz/typescript/config';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import { isRecord } from '../../../lint/kit/project/json-shape.js';
import { resolveRoot } from '../../../lint/kit/project/resolve.js';
import type { ChainConfig, Started } from '../../chain/config.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { refusal } from '../../chain/refusals/refusal.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import type { LintSpecification } from './lint.composition.js';
import { lintDefinition } from './lint.composition.js';
import type { LintPort } from './lint.port.js';
import { localLinters } from './local-linters.adapter.js';
import type { LintConfig } from './local-linters.adapter.js';

export type LintSpecificationConfig = ChainConfig & { linters?: LintPort | undefined };

/** Options for {@link startLint | specification.lint}; at least one linter: a plugin, a config, a checker or a preset. */
export type LintSpecificationOptions = {
    /** Cross-file checkers, each a command printing a finding a line as `<file>:<line>:<column>: error <plugin>(<rule>): <message>`; `.run()` hands it the tree as its last argument. */
    checkers?: readonly string[];
    /** The oxlint config oxlint runs under (`rules`, `settings`, `categories`, `overrides`), less `jsPlugins`, which `plugins` states; naming it alone runs oxlint's built-in rules. */
    config?: LintConfig;
    /** oxlint JS plugins, each a path from the specification's folder or a package specifier. */
    plugins?: readonly string[];
    /** `@jterrazz/typescript` presets whose laws run on the tree, after the base preset, as `studio.config.ts` lists them: `[]` holds the tree to the base preset alone. */
    presets?: readonly Preset[];
    /** Project root override: the plugins' specifiers and the checkers' commands resolve from its `node_modules`. */
    root?: string;
    /** What the project adds beside its presets, written as `studio.config.ts` writes it: `typescript: { names, architecture }`, `optOuts`. */
    settings?: Readonly<Record<string, unknown>>;
};

/** What `specification.lint()` returns: `const { lint, cleanup } = ...` (`no-runner-alias`). */
export type LintHandle = {
    /** Nothing is started: kept so every constructor is released the same way. */
    cleanup: () => Promise<void>;
    lint: LintSpecification;
};

function pluginPath(plugin: string, callerDir: string, root: string): string {
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
                read: 'docs/guides/lint-specs.md#options',
                why: 'A plugin is loaded by the oxlint the specification runs, from the path it resolves to.',
            }),
        );
    }
}

// outside: the oxlint bin a manifest names, as its one bin or under its own name.
function binOf(manifest: string): null | string {
    // Stryker disable next-line StringLiteral: a manifest read as a Buffer parses as the same text
    const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
    const bin = isRecord(parsed) ? parsed.bin : null;
    const named = isRecord(bin) ? bin.oxlint : bin;
    return typeof named === 'string' ? join(dirname(manifest), named) : null;
}

// outside: the oxlint bin an anchor resolves, or none when no oxlint resolves from it.
function binFrom(anchor: string): null | string {
    let manifest: string;
    try {
        manifest = createRequire(anchor).resolve('oxlint/package.json');
    } catch {
        return null;
    }
    return binOf(manifest);
}

export function oxlintBinary(anchors: readonly string[]): string {
    for (const from of anchors) {
        const bin = binFrom(from);
        if (bin !== null) {
            return bin;
        }
    }
    throw new Error(
        refusal({
            fix: 'install oxlint, an optional peer of @jterrazz/test, beside the project',
            found: `specification.lint() runs oxlint, and none resolves from ${anchors.join(', ')}`,
            read: 'docs/guides/lint-specs.md#options',
            why: 'A plugin and a config are run by the real oxlint, the one a project lints with.',
        }),
    );
}

export async function startLint(options: LintSpecificationOptions): Promise<LintHandle> {
    const callerDir = getCallerDir();
    await registerMatchers();
    const root = resolveRoot(options.root, callerDir);
    const plugins = (options.plugins ?? []).map((plugin) => pluginPath(plugin, callerDir, root));
    const checkers = options.checkers ?? [];
    const runsOxlint = plugins.length > 0 || options.config !== undefined;
    if (!runsOxlint && checkers.length === 0 && options.presets === undefined) {
        throw new Error(
            refusal({
                fix: 'name the plugins, the config, the checkers or the presets the specification lints with (`presets: []` for the base preset alone)',
                found: 'specification.lint() with no plugin, no config, no checker and no presets',
                read: 'docs/guides/lint-specs.md#options',
                why: 'A lint specification runs the linters it names, and one that names none judges nothing.',
            }),
        );
    }
    const oxlint = runsOxlint
        ? oxlintBinary([join(root, 'package.json'), import.meta.filename])
        : null;
    const config: Started<LintSpecificationConfig, 'linters'> = {
        linters: localLinters({
            checkers,
            config: options.config ?? {},
            oxlint,
            plugins,
            presets: options.presets,
            root,
            settings: options.settings ?? {},
        }),
        root,
    };
    return {
        cleanup: async () => {
            // invariant: a lint runner starts no process and no service, so there is nothing to stop.
        },
        lint: lintDefinition.open(config),
    };
}
