import { cpSync, readFileSync, writeFileSync } from 'node:fs';

import { shouldUpdateSnapshots } from '../../../vitest/update.js';
import {
    type LiterateBlock,
    type LiterateSpec,
    parseLiterateFile,
    serializeLiterateFile,
} from '../../literate/literate-file.js';
import { CaptureScope } from '../../matching/match.js';
import { mergeTextPreservingPlaceholders, textEquals } from '../../matching/structural.js';
import type { CliEnv, CliOutput } from '../../ports/cli.port.js';
import type { SpecificationConfig } from '../shared/builder.js';
import { copyPlan } from '../shared/fixtures.js';
import { formatStdoutDiff } from '../shared/reporter.js';
import { safeRealpath } from '../shared/result/result.js';
import { stripAnsiCodes } from '../shared/result/text.js';
import { ServeAdapter } from '../website/serve.adapter.js';
import { CliResult } from './result.js';

/**
 * Running a literate `<case>.cli` spec: one scenario, one workdir, one set of
 * servers, every `$` block executed and asserted.
 *
 * The engine composes pieces that already exist rather than adding a second of
 * anything — {@link copyPlan} for `fixture:`, the runner's own command adapter
 * for each block, {@link ServeAdapter} for `serve:`, the `{{token}}` engine for
 * the comparison, and {@link mergeTextPreservingPlaceholders} for the rewrite.
 * What is new here is only the ORCHESTRATION the chain cannot express: several
 * commands sharing one working directory, each asserted, none stopping the run.
 */

// ── Types ──

/**
 * A server a literate header may start by name (`serve: mcp KEY=value`),
 * registered once per app in the `serve` option of `specification.cli()`.
 */
export interface LiterateServeRegistration {
    /** Shell command that starts the server, run from the project root. */
    command: string;
    /** The variable the resolved URL is bound to in every block's child env. */
    env: string;
    /**
     * Matched against the server's output; the FIRST capture group is the port
     * it chose — named (`(?<port>\d+)`) or not, it is group 1 either way.
     */
    ready: RegExp;
    /** Builds the URL bound to {@link env} from the announced port. */
    url: (port: number) => string;
}

/** Per-call options for {@link runLiterateSpec} / `cli.run()`. */
export interface LiterateRunFlags {
    /**
     * Opt this file OUT of the update-mode rewrite. A frozen file is NEVER
     * written under `TEST_UPDATE=1`: its mismatch still throws its diff. That
     * is what makes a DELIBERATELY-WRONG `.cli` — one whose failure rendering
     * is the subject of a negative test — survive an update run instead of
     * being silently corrected into a passing file. The `.cli` mirror of
     * `toMatch(name, { frozen: true })`.
     */
    frozen?: boolean;
}

/** Everything the engine needs to run one file. Assembled by the chain. */
export interface LiterateRunOptions extends LiterateRunFlags {
    /** Env the chain already resolved: service URLs, docker run id, `.env()`. */
    baseEnv?: CliEnv;
    config: SpecificationConfig;
    /** Absolute path of the `.cli` file. */
    filePath: string;
    /** The path failures name — as the reader would open it. */
    displayPath: string;
    /** Directory `expected/` fixtures of follow-up assertions resolve against. */
    testDir: string;
    /** The shared working directory every block runs in. */
    workDir: string;
}

/** One block's outcome, kept for the failure rendering and the rewrite. */
interface BlockRun {
    actual: CliOutput;
    block: LiterateBlock;
    /** Streams as compared: ANSI stripped, `transform` applied, one trailing newline dropped. */
    stderr: string;
    stdout: string;
}

// ── Comparison ──

/**
 * The form a stream is compared in: ANSI stripped (rule D6), the runner's
 * `transform` applied, and ONE trailing newline dropped — a `.cli` section is
 * written as lines, and a command that ends its output with a newline must not
 * be forced to spell an empty last line.
 */
function comparable(raw: string, transform?: (text: string) => string): string {
    const stripped = stripAnsiCodes(raw);
    return (transform ? transform(stripped) : stripped).replace(/\n$/, '');
}

function narrative(spec: LiterateSpec): string {
    return [
        `test: ${spec.header.test}`,
        `given: ${spec.header.given}`,
        `then: ${spec.header.then}`,
    ].join('\n');
}

/**
 * The failure a mismatching block throws: the narrative, the command that ran,
 * the diff, and where to open the file. The header is named as never-rewritten
 * so the update hint cannot be read as "this will re-generate my `given:`".
 */
function failure(spec: LiterateSpec, run: BlockRun, displayPath: string, detail: string): Error {
    return new Error(
        [
            `Literate spec mismatch (${displayPath}:${run.block.line})`,
            '',
            narrative(spec),
            '',
            `$ ${run.block.argv}`,
            '',
            detail,
            '',
            'Run with TEST_UPDATE=1 to rewrite the blocks (exit code and streams). The header is never rewritten.',
        ].join('\n'),
    );
}

/** Compare one block against what the command actually did. */
function assertBlock(
    spec: LiterateSpec,
    run: BlockRun,
    displayPath: string,
    scope: CaptureScope,
): void {
    const { actual, block } = run;
    if (actual.exitCode !== block.exitCode) {
        throw failure(
            spec,
            run,
            displayPath,
            [
                'exit code mismatch',
                `  expected: ${block.exitCode}`,
                `  received: ${actual.exitCode}`,
                ...(run.stderr.length > 0 ? ['', 'stderr was:', run.stderr] : []),
            ].join('\n'),
        );
    }
    if (!textEquals(block.stdout, run.stdout, scope)) {
        throw failure(spec, run, displayPath, formatStdoutDiff('stdout', block.stdout, run.stdout));
    }
    const expectedStderr = block.stderr ?? '';
    if (!textEquals(expectedStderr, run.stderr, scope)) {
        throw failure(
            spec,
            run,
            displayPath,
            formatStdoutDiff('stderr', expectedStderr, run.stderr),
        );
    }
}

// ── Update ──

/**
 * The rewritten blocks: exit codes and streams from the run, placeholders of
 * the previous golden preserved by pattern (rule D5). A `--- stderr` section
 * that ends up empty is dropped, so a rewritten file passes the next run.
 */
function updatedBlocks(runs: BlockRun[], scope: CaptureScope): LiterateBlock[] {
    return runs.map(({ actual, block, stderr, stdout }) => {
        const mergedStderr = mergeTextPreservingPlaceholders(block.stderr, stderr, scope);
        return {
            ...block,
            exitCode: actual.exitCode,
            stderr: mergedStderr.length > 0 ? mergedStderr : null,
            stdout: mergeTextPreservingPlaceholders(block.stdout, stdout, scope),
        };
    });
}

// ── Servers ──

/**
 * Start every server the header names, in declaration order, before the first
 * block. They all stay live for the whole file and are stopped together — one
 * `.cli` file is one scenario, and its servers are part of its ground.
 */
async function startServers(
    spec: LiterateSpec,
    config: SpecificationConfig,
    displayPath: string,
): Promise<{ env: CliEnv; stop: () => Promise<void> }> {
    const registry = config.serveRegistry ?? {};
    const started: ServeAdapter[] = [];
    const env: CliEnv = {};

    const stop = async (): Promise<void> => {
        for (const adapter of started.toReversed()) {
            await adapter.stop();
        }
    };

    for (const entry of spec.header.serve) {
        const registration = registry[entry.name];
        if (!registration) {
            await stop();
            const known = Object.keys(registry);
            throw new Error(
                `${displayPath}:${entry.line}: serve: "${entry.name}" is not registered — ${
                    known.length === 0
                        ? 'specification.cli() declares no `serve` option.'
                        : `registered servers: ${known.join(', ')}.`
                }`,
            );
        }
        const adapter = new ServeAdapter(
            { command: registration.command, ready: registration.ready },
            config.root ?? process.cwd(),
            'cli',
            entry.env,
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

// ── Environment ──

/** Resolve the header's `env:` tokens against the registered sets. `$WORKDIR` expands. */
function headerEnv(spec: LiterateSpec, config: SpecificationConfig, displayPath: string): CliEnv {
    const sets = config.envSets ?? {};
    const env: CliEnv = {};
    for (const token of spec.header.env) {
        if (token.kind === 'set') {
            const declared = sets[token.name];
            if (!declared) {
                const known = Object.keys(sets);
                throw new Error(
                    `${displayPath}: env: "${token.name}" is not a registered env set — ${
                        known.length === 0
                            ? 'specification.cli() declares no `env` option.'
                            : `registered sets: ${known.join(', ')}.`
                    }`,
                );
            }
            Object.assign(env, declared);
            continue;
        }
        env[token.key] = token.value;
    }
    return env;
}

function expandWorkdir(env: CliEnv, workDir: string): CliEnv {
    const resolved: CliEnv = {};
    for (const [key, value] of Object.entries(env)) {
        resolved[key] = typeof value === 'string' ? value.replace(/\$WORKDIR/g, workDir) : value;
    }
    return resolved;
}

// ── Engine ──

/**
 * Run one literate spec end to end and resolve with the LAST block's result —
 * the handle a `.test.ts` adds its own assertion to (a directory golden, a
 * grep) after `cli.run('<case>.cli')`.
 *
 * Under `TEST_UPDATE=1` nothing is asserted: every block runs, and what follows
 * each `$` is rewritten from the actual output with the previous golden's
 * placeholders preserved.
 */
export async function runLiterateSpec(options: LiterateRunOptions): Promise<CliResult> {
    const { config, displayPath, filePath, testDir, workDir } = options;
    if (!config.command) {
        throw new Error(
            '.run(): literate specs require a command adapter (use specification.cli())',
        );
    }

    const spec = parseLiterateFile(readFileSync(filePath, 'utf8'), displayPath);
    const fileDir = filePath.replace(/[/\\][^/\\]*$/, '');

    // `fixture:` layers on top of whatever the chain already copied, in
    // Declaration order — identical semantics to chained `.fixture()` calls.
    for (const path of spec.header.fixtures) {
        const { dest, src } = copyPlan(path, fileDir, workDir);
        cpSync(src, dest, { recursive: true });
    }

    const servers = await startServers(spec, config, displayPath);
    const scope = new CaptureScope(safeRealpath(workDir));
    const env: CliEnv = expandWorkdir(
        {
            ...options.baseEnv,
            ...servers.env,
            ...headerEnv(spec, config, displayPath),
        },
        workDir,
    );

    let runs: BlockRun[];
    try {
        runs = [];
        for (const block of spec.blocks) {
            const actual = await config.command.exec(block.argv, workDir, env);
            runs.push({
                actual,
                block,
                stderr: comparable(actual.stderr, config.transform),
                stdout: comparable(actual.stdout, config.transform),
            });
        }
    } finally {
        await servers.stop();
    }

    if (shouldUpdateSnapshots() && options.frozen !== true) {
        writeFileSync(filePath, serializeLiterateFile(spec.headerText, updatedBlocks(runs, scope)));
    } else {
        for (const run of runs) {
            assertBlock(spec, run, displayPath, scope);
        }
    }

    return new CliResult({
        commandOutput: runs.at(-1)!.actual,
        config,
        dockerConfig: config.dockerConfig,
        testDir,
        testRunId: config.dockerTestRunId,
        transform: config.transform,
        workDir,
    });
}

/** The title a transformed `.cli` module runs under — the header's `test:` line. */
export function literateTitle(content: string, displayPath: string): string {
    return parseLiterateFile(content, displayPath).header.test;
}
