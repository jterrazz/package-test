import { presetChecks } from '@jterrazz/typescript/rules';
import type { Preset } from '@jterrazz/typescript/rules';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { refusal } from '../../../lint/index.refusal.js';
import { scratchDirectory } from '../../kernel/files/scratch.js';
import { diagnosticsOf, presetDiagnostic } from './lint-report.js';
import type { Diagnostic } from './lint-report.js';
import type { LintPort, LintRules, LintRun } from './lint.port.js';

export type LintConfig = { readonly [key: string]: unknown; readonly rules?: LintRules };

export type Linters = {
    checkers: readonly string[];
    config: LintConfig;
    oxlint: null | string;
    plugins: readonly string[];
    presets: readonly Preset[];
    root: string;
};

const environment = (): NodeJS.ProcessEnv => ({ ...process.env, INIT_CWD: undefined });

function installed(checker: string, root: string): string {
    const [command = '', ...rest] = checker.split(' ');
    const local = join(root, 'node_modules/.bin', command);
    return [existsSync(local) ? local : command, ...rest].join(' ');
}

function unreported(linter: string, output: string): Error {
    return new Error(
        refusal({
            fix: `run ${linter} on the fixture by hand and correct what stops it — a plugin that does not load, a config it refuses`,
            found: `${linter} failed and reported no diagnostic: ${output.trim().split('\n').slice(0, 5).join(' / ')}`,
            read: 'docs/21-lint.md#what-run-runs',
            why: 'A linter that fails without a diagnostic judged nothing, and an empty report would read as a clean tree.',
        }),
    );
}

function runOxlint(tree: string, linters: Linters, run: LintRun, fix: boolean): Diagnostic[] {
    const config = join(scratchDirectory('spec-lint-config-'), 'oxlint.json');
    writeFileSync(
        config,
        JSON.stringify({
            ...linters.config,
            jsPlugins: linters.plugins,
            rules: { ...linters.config.rules, ...run.rules },
        }),
    );
    const ran = spawnSync(
        process.execPath,
        [linters.oxlint ?? '', '--format=unix', '-c', config, ...(fix ? ['--fix'] : []), '.'],
        { cwd: tree, encoding: 'utf8', env: environment() },
    );
    const output = `${ran.stdout ?? ''}${ran.stderr ?? ''}`;
    const diagnostics = diagnosticsOf(output);
    if (ran.status !== 0 && diagnostics.length === 0) {
        throw unreported('oxlint', output);
    }
    return diagnostics;
}

function runChecker(
    tree: string,
    { checker, root }: { checker: string; root: string },
    run: LintRun,
    fix: boolean,
): Diagnostic[] {
    const command = [installed(checker, root), run.args, '.', fix ? '--fix' : ''];
    const ran = spawnSync(command.filter(Boolean).join(' '), {
        cwd: tree,
        encoding: 'utf8',
        env: environment(),
        shell: true,
    });
    const output = `${ran.stdout ?? ''}${ran.stderr ?? ''}`;
    const diagnostics = diagnosticsOf(output);
    if (ran.status !== 0 && diagnostics.length === 0) {
        throw unreported(checker, output);
    }
    return diagnostics;
}

function linted(tree: string, linters: Linters, run: LintRun, fix: boolean): Diagnostic[] {
    return [
        ...(linters.plugins.length === 0 ? [] : runOxlint(tree, linters, run, fix)),
        ...linters.checkers.flatMap((checker) =>
            runChecker(tree, { checker, root: linters.root }, run, fix),
        ),
    ];
}

async function presetDiagnostics(tree: string, linters: Linters): Promise<Diagnostic[]> {
    if (linters.presets.length === 0) {
        return [];
    }
    const { findings, problems } = await presetChecks(tree, linters.presets);
    if (problems.length > 0) {
        throw unreported('the presets’ checks', problems.join('\n'));
    }
    return findings.map((finding) => presetDiagnostic(finding));
}

export function localLinters(linters: Linters): LintPort {
    return {
        lint: async (tree, run) => {
            if (run.fix) {
                linted(tree, linters, run, true);
            }
            return [
                ...linted(tree, linters, run, false),
                ...(await presetDiagnostics(tree, linters)),
            ];
        },
    };
}
