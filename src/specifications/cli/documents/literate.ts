import { readFileSync, writeFileSync } from 'node:fs';

import { safeRealpath } from '../../../../lint/kit/project/resolve.js';
import { readSpecFile } from '../../../../lint/kit/project/spec-document.js';
import { SpecSyntaxError } from '../../../../lint/kit/project/spec-grammar.js';
import type { SpecFile, SpecRun } from '../../../../lint/kit/project/spec-grammar.js';
import { updateSpecFile } from '../../../../lint/kit/project/spec-update.js';
import { invariant } from '../../../chain/refusals/refusal.js';
import { fsFixtures } from '../../../disk/fs-fixtures.adapter.js';
import { CliResult } from '../../../expectations/command/cli.result.js';
import { shouldUpdateSnapshots } from '../../../expectations/in-place/update.js';
import { CaptureScope } from '../../../expectations/tokens/capture-scope.js';
import type { CliConfig } from '../cli.handle.js';
import type { CliEnv, CliOutput, CliPort } from '../process/cli.port.js';
import { expandWorkdir } from '../process/env.capability.js';
import { documentEnv, startServers } from './literate-env.js';
import { assertFiles, assertRun, atLine, comparable, updates } from './literate-judge.js';
import type { Judgement, RunOutcome } from './literate-judge.js';
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

function readDocument(filePath: string, displayPath: string): SpecFile {
    try {
        return readSpecFile(readFileSync(filePath, 'utf8'), displayPath);
    } catch (error) {
        throw error instanceof SpecSyntaxError
            ? atLine(grammarRefusal(error, displayPath), filePath, error.line)
            : error;
    }
}

type Session = {
    command: CliPort;
    env: CliEnv;
    transform: CliConfig['transform'];
    workDir: string;
};

async function execute(run: SpecRun, session: Session): Promise<RunOutcome> {
    const { command, env, transform, workDir } = session;
    const timeout = run.timeout ?? undefined;
    const actual: CliOutput =
        run.waitFor === null
            ? await command.exec(run.command, workDir, env, {
                  stdin: run.stdin ?? undefined,
                  timeout,
              })
            : await command.watch(run.command, workDir, { timeout, waitFor: run.waitFor }, env);
    return {
        actual,
        run,
        stderr: comparable(actual.stderr, transform),
        stdout: comparable(actual.stdout, transform),
    };
}

function lastResult(outcomes: readonly RunOutcome[], options: LiterateRunOptions): CliResult {
    const { config, testDir, workDir } = options;
    const lastOutcome = outcomes.at(-1);
    if (lastOutcome === undefined) {
        throw invariant('a document ran no command, though its runs: holds at least one');
    }
    return new CliResult({
        commandOutput: lastOutcome.actual,
        config,
        dockerConfig: config.dockerConfig,
        testDir,
        testRunId: config.dockerTestRunId,
        transform: config.transform,
        workDir,
    });
}

/** Resolves with the last run's result. Under `TEST_UPDATE=1` every run executes and is rewritten; its `files:` are still judged. */
export async function runSpecDocument(options: LiterateRunOptions): Promise<CliResult> {
    const { config, displayPath, filePath, workDir } = options;
    const { command } = config;
    if (!command) {
        throw invariant('.run() reached a chain with no command adapter');
    }
    const file = readDocument(filePath, displayPath);
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
    const judgement: Judgement = { displayPath, document, filePath, scope, workDir };
    const session: Session = { command, env, transform: config.transform, workDir };

    // invariant: a rewrite needs every run executed; a normal session judges each run where it stands.
    const rewriting = shouldUpdateSnapshots() && options.frozen !== true;
    const outcomes: RunOutcome[] = [];
    try {
        for (const run of document.runs) {
            const outcome = await execute(run, session);
            outcomes.push(outcome);
            // invariant: judged here, before the next command: a run's `files:` describes the directory as this run left it.
            if (rewriting) {
                assertFiles(outcome, judgement);
            } else {
                assertRun(outcome, judgement);
            }
        }
    } finally {
        await servers.stop();
    }

    if (rewriting) {
        writeFileSync(filePath, updateSpecFile(file, updates(outcomes, scope)));
    }

    return lastResult(outcomes, options);
}
