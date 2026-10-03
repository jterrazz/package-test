import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { safeRealpath } from '../../../../lint/kit/project/resolve.js';
import {
    readSpecFile,
    SpecSyntaxError,
    updateSpecFile,
} from '../../../../lint/kit/project/spec-document.js';
import type {
    SpecDocument,
    SpecFile,
    SpecFileAssertion,
    SpecRun,
} from '../../../../lint/kit/project/spec-document.js';
import { invariant, refusal } from '../../../chain/refusals/refusal.js';
import { fsFixtures } from '../../../disk/fs-fixtures.adapter.js';
import { CliResult } from '../../../expectations/command/cli.result.js';
import { formatStdoutDiff } from '../../../expectations/goldens/diff.js';
import { shouldUpdateSnapshots } from '../../../expectations/in-place/update.js';
import { stripAnsiCodes } from '../../../expectations/text/ansi.js';
import { CaptureScope } from '../../../expectations/tokens/match.js';
import { textContains, textEquals } from '../../../expectations/tokens/structural.js';
import { mergeTextPreservingPlaceholders } from '../../../expectations/tokens/update-merge.js';
import { ServedProcess } from '../../../services/process/serve.js';
import type { CliConfig } from '../cli.handle.js';
import type { CliEnv, CliOutput } from '../process/cli.port.js';
import { expandWorkdir } from '../process/env.capability.js';
import { grammarRefusal } from './literate-plugin.js';

/** Runs a `<case>.spec.yaml`: several commands in one working directory, each judged the moment it ends. */

/** Per-call options for {@link runSpecDocument} / `cli.run()`. */
export type LiterateRunFlags = {
    /** Opt this document out of the update-mode rewrite: a deliberately-wrong `.spec.yaml` survives update runs. */
    frozen?: boolean | undefined;
};

export type LiterateRunOptions = LiterateRunFlags & {
    baseEnv?: CliEnv | undefined;
    config: CliConfig;
    displayPath: string;
    filePath: string;
    testDir: string;
    workDir: string;
};

type RunOutcome = {
    actual: CliOutput;
    run: SpecRun;
    /** Streams as compared: ANSI stripped and `transform` applied, byte for byte. */
    stderr: string;
    stdout: string;
};

type FailureContext = {
    displayPath: string;
    filePath: string;
};

/** ANSI stripped (`no-transform-duplicating-tokens`) and `transform` applied, nothing else: a block scalar states its own final newline. */
function comparable(raw: string, transform?: (text: string) => string): string {
    const stripped = stripAnsiCodes(raw);
    return transform ? transform(stripped) : stripped;
}

/** Each line on a fresh scope: a ref captured by an earlier line must not decide how a later one displays. */
function tokenAwareEquals(scope: CaptureScope): (expected: string, actual: string) => boolean {
    return (expected, actual) => textEquals(expected, actual, new CaptureScope(scope.workdir));
}

function resolveUnderWorkDir(path: string, workDir: string, context: FailureContext): string {
    const target = resolve(workDir, path);
    const inside = relative(workDir, target);
    if (isAbsolute(path) || inside.startsWith('..') || isAbsolute(inside)) {
        throw new Error(
            refusal({
                fix: 'name a relative path under the working directory',
                found: `${context.displayPath}: files: "${path}" leaves the working directory`,
                read: 'docs/15-documents.md#files--what-the-run-left-behind',
                why: 'A `files:` key is a relative path under the working directory.',
            }),
        );
    }
    return target;
}

function preview(text: string): string {
    const flat = JSON.stringify(text.length > 160 ? `${text.slice(0, 160)}…` : text);
    return flat;
}

function readIfPresent(path: string): null | string {
    try {
        return statSync(path).isFile() ? readFileSync(path, 'utf8') : null;
    } catch {
        return null;
    }
}

function checkFile(
    assertion: SpecFileAssertion,
    workDir: string,
    context: FailureContext,
    scope: CaptureScope,
): null | string {
    const target = resolveUnderWorkDir(assertion.path, workDir, context);
    let exists;
    try {
        exists = statSync(target) !== undefined;
    } catch {
        exists = false;
    }
    if (assertion.kind === 'absent') {
        return exists ? `${assertion.path}: expected absent, got a file` : null;
    }
    if (!exists) {
        return `${assertion.path}: expected to exist, got nothing at that path`;
    }
    if (assertion.kind === 'exists') {
        return null;
    }
    const content = readIfPresent(target);
    if (content === null) {
        return `${assertion.path}: expected a readable file, got a directory`;
    }
    for (const needle of assertion.contains) {
        if (!textContains(needle.text, content, scope)) {
            return `${assertion.path}: expected to contain ${preview(needle.text)}, got ${preview(content)}`;
        }
    }
    if (assertion.equals !== null && !textEquals(assertion.equals.text, content, scope)) {
        return `${assertion.path}: expected ${preview(assertion.equals.text)}, got ${preview(content)}`;
    }
    return null;
}

/** The stack is replaced by the run's own line: the runner's frames end in the plugin's generated module. */
function failure(
    document: SpecDocument,
    run: SpecRun,
    context: FailureContext,
    details: string[],
): Error {
    const error = new Error(
        refusal({
            fix: 'correct the command, or run with TEST_UPDATE=1 to rewrite the runs — the exit code and the streams, and nothing else',
            found: [
                `spec mismatch — ${document.description}`,
                '',
                `$ ${run.command}`,
                '',
                details.join('\n\n'),
                '',
                `${context.displayPath}:${run.commandLine}`,
            ].join('\n'),
            read: 'docs/15-documents.md#failure-and-update',
            why: 'A spec document states what its runs produce: the exit code and the streams, whole.',
        }),
    );
    return atLine(error, context.filePath, run.commandLine);
}

function atLine(error: Error, filePath: string, line: number): Error {
    error.stack = `${error.name}: ${error.message}\n    at ${filePath}:${line}:1`;
    return error;
}

function assertRun(
    document: SpecDocument,
    outcome: RunOutcome,
    context: FailureContext,
    workDir: string,
    scope: CaptureScope,
): void {
    const { actual, run } = outcome;
    // invariant: an exit-code mismatch is reported alone: the stream diffs are its consequences.
    if (actual.exitCode !== run.exitCode) {
        throw failure(document, run, context, [
            [
                'exit code mismatch',
                `  expected: ${run.exitCode}`,
                `  received: ${actual.exitCode}`,
                // invariant: the stream carries its own final newline; the joiner adds the separator.
                ...(outcome.stderr.length > 0
                    ? ['', 'stderr was:', outcome.stderr.replace(/\n$/u, '')]
                    : []),
            ].join('\n'),
        ]);
    }

    const equals = tokenAwareEquals(scope);
    const details: string[] = [];
    for (const [name, expected, received] of [
        ['stdout', run.stdout?.text ?? '', outcome.stdout],
        ['stderr', run.stderr?.text ?? '', outcome.stderr],
    ] as const) {
        if (!textEquals(expected, received, scope)) {
            details.push(formatStdoutDiff(name, expected, received, { equals }));
        }
    }

    const fileFailures = run.files
        .map((assertion) => checkFile(assertion, workDir, context, scope))
        .filter((line): line is string => line !== null);
    if (fileFailures.length > 0) {
        details.push(['files mismatch', '', ...fileFailures.map((line) => `  ${line}`)].join('\n'));
    }

    if (details.length > 0) {
        throw failure(document, run, context, details);
    }
}

/** Placeholders of the previous golden preserved by pattern (`no-volatile-literal`); an emptied stream loses its key. */
function updates(outcomes: RunOutcome[], scope: CaptureScope) {
    return outcomes.map(({ actual, run, stderr, stdout }) => ({
        exitCode: actual.exitCode,
        stderr: mergeTextPreservingPlaceholders(run.stderr?.text ?? null, stderr, scope),
        stdout: mergeTextPreservingPlaceholders(run.stdout?.text ?? null, stdout, scope),
    }));
}

/** Every child gets `TEST_WORKDIR`, the resolved working directory, with the fixtures already on disk; the document's own env wins. */
async function startServers(
    document: SpecDocument,
    config: CliConfig,
    displayPath: string,
    workdir: string,
): Promise<{ env: CliEnv; stop: () => Promise<void> }> {
    const registry = config.serveRegistry ?? {};
    const started: ServedProcess[] = [];
    const env: CliEnv = {};

    const stop = async (): Promise<void> => {
        for (const adapter of started.toReversed()) {
            await adapter.stop();
        }
    };

    for (const entry of document.serve) {
        const registration = registry[entry.name];
        if (!registration) {
            await stop();
            const known = Object.keys(registry);
            throw new Error(
                refusal({
                    fix:
                        known.length === 0
                            ? 'register it in the `serve` option of specification.cli()'
                            : `serve a registered server: ${known.join(', ')}`,
                    found: `${displayPath}:${entry.line}: serve: "${entry.name}" is not registered`,
                    read: 'docs/14-cli.md#registration--once-per-app',
                    why: 'A document serves what the app registered once, in the options of specification.cli().',
                }),
            );
        }
        const adapter = new ServedProcess(
            { command: registration.command, ready: registration.ready },
            config.root ?? process.cwd(),
            'cli',
            { TEST_WORKDIR: workdir, ...entry.env },
        );
        started.push(adapter);
        try {
            await adapter.start();
        } catch (error) {
            await stop();
            throw error;
        }
        env[registration.env] = registration.url(adapter.port!);
    }

    return { env, stop };
}

function documentEnv(document: SpecDocument, config: CliConfig, displayPath: string): CliEnv {
    const sets = config.envSets ?? {};
    const env: CliEnv = {};
    for (const token of document.env) {
        if (token.kind === 'set') {
            const declared = sets[token.name];
            if (!declared) {
                const known = Object.keys(sets);
                throw new Error(
                    refusal({
                        fix:
                            known.length === 0
                                ? 'register it in the `env` option of specification.cli(), or write it inline: KEY=value'
                                : `name a registered set: ${known.join(', ')}, or write it inline: KEY=value`,
                        found: `${displayPath}:${token.line}: env: "${token.name}" is not a registered env set`,
                        read: 'docs/14-cli.md#registration--once-per-app',
                        why: 'A bare word under `env:` names a set the app registered once, in the options of specification.cli().',
                    }),
                );
            }
            Object.assign(env, declared);
            continue;
        }
        env[token.key] = token.value;
    }
    return env;
}

/** Resolves with the last run's result. Under `TEST_UPDATE=1` nothing is asserted: every run executes and is rewritten. */
export async function runSpecDocument(options: LiterateRunOptions): Promise<CliResult> {
    const { config, displayPath, filePath, testDir, workDir } = options;
    if (!config.command) {
        throw invariant('.run() reached a chain with no command adapter');
    }

    let file: SpecFile;
    try {
        file = readSpecFile(readFileSync(filePath, 'utf8'), displayPath);
    } catch (error) {
        throw error instanceof SpecSyntaxError
            ? atLine(grammarRefusal(error, displayPath), filePath, error.line)
            : error;
    }
    const { document } = file;
    const fileDir = filePath.replace(/[/\\][^/\\]*$/u, '');

    // invariant: layered over what the chain copied, in declaration order, as chained `.fixture()` calls are.
    for (const fixture of document.fixtures) {
        fsFixtures.layer(fixture.path, fileDir, workDir);
    }

    // invariant: one resolved spelling of the working directory for `{{workdir}}`, `$WORKDIR` and `TEST_WORKDIR`.
    const workdir = safeRealpath(workDir);
    const servers = await startServers(document, config, displayPath, workdir);
    const scope = new CaptureScope(workdir);
    const env: CliEnv = expandWorkdir(
        {
            ...options.baseEnv,
            ...servers.env,
            ...documentEnv(document, config, displayPath),
        },
        workdir,
    );

    // invariant: a rewrite needs every run executed; a normal session judges each run where it stands.
    const rewriting = shouldUpdateSnapshots() && options.frozen !== true;
    const outcomes: RunOutcome[] = [];
    try {
        for (const run of document.runs) {
            const actual =
                run.waitFor === null
                    ? await config.command.exec(run.command, workDir, env, {
                          stdin: run.stdin ?? undefined,
                          timeout: run.timeout ?? undefined,
                      })
                    : await config.command.watch(
                          run.command,
                          workDir,
                          { timeout: run.timeout ?? undefined, waitFor: run.waitFor },
                          env,
                      );
            const outcome: RunOutcome = {
                actual,
                run,
                stderr: comparable(actual.stderr, config.transform),
                stdout: comparable(actual.stdout, config.transform),
            };
            outcomes.push(outcome);
            // invariant: judged here, before the next command: a run's `files:` describes the directory as this run left it.
            if (!rewriting) {
                assertRun(document, outcome, { displayPath, filePath }, workDir, scope);
            }
        }
    } finally {
        await servers.stop();
    }

    if (rewriting) {
        writeFileSync(filePath, updateSpecFile(file, updates(outcomes, scope)));
    }

    return new CliResult({
        commandOutput: outcomes.at(-1)!.actual,
        config,
        dockerConfig: config.dockerConfig,
        testDir,
        testRunId: config.dockerTestRunId,
        transform: config.transform,
        workDir,
    });
}
