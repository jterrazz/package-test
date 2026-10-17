import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import type {
    SpecDocument,
    SpecFileAssertion,
    SpecRun,
} from '../../../../lint/kit/project/spec-grammar.js';
import { refusal } from '../../../chain/refusals/refusal.js';
import { formatStdoutDiff } from '../../../expectations/goldens/diff.js';
import { stripAnsiCodes } from '../../../expectations/text/ansi.js';
import { CaptureScope } from '../../../expectations/tokens/capture-scope.js';
import { textContains, textEquals } from '../../../expectations/tokens/structural.js';
import { mergeTextPreservingPlaceholders } from '../../../expectations/tokens/update-merge.js';
import type { CliOutput } from '../process/cli.port.js';

export type RunOutcome = {
    actual: CliOutput;
    run: SpecRun;
    /** Streams as compared: ANSI stripped and `transform` applied, byte for byte. */
    stderr: string;
    stdout: string;
};

/** Where a run is judged: the document it belongs to, the directory it ran in, the refs its lines captured. */
export type Judgement = {
    displayPath: string;
    document: SpecDocument;
    filePath: string;
    scope: CaptureScope;
    workDir: string;
};

/** ANSI stripped (`no-transform-duplicating-tokens`) and `transform` applied, nothing else: a block scalar states its own final newline. */
export function comparable(raw: string, transform?: (text: string) => string): string {
    const stripped = stripAnsiCodes(raw);
    return transform ? transform(stripped) : stripped;
}

// invariant: each line on a fresh scope: a ref captured by an earlier line must not decide how a later one displays.
function tokenAwareEquals(scope: CaptureScope): (expected: string, actual: string) => boolean {
    return (expected, actual) => textEquals(expected, actual, new CaptureScope(scope.workdir));
}

function resolveUnderWorkDir(path: string, context: Judgement): string {
    const { workDir } = context;
    const target = resolve(workDir, path);
    const inside = relative(workDir, target);
    if (isAbsolute(path) || inside.startsWith('..') || isAbsolute(inside)) {
        throw new Error(
            refusal({
                fix: 'name a relative path under the working directory',
                found: `${context.displayPath}: files: "${path}" leaves the working directory`,
                read: 'docs/guides/spec-documents.md#files--what-the-run-left-behind',
                why: 'A `files:` key is a relative path under the working directory.',
            }),
        );
    }
    return target;
}

function preview(text: string): string {
    const flat = JSON.stringify(text.length > 160 ? `${text.slice(0, 160)}...` : text);
    return flat;
}

function readIfPresent(path: string): null | string {
    try {
        return statSync(path).isFile() ? readFileSync(path, 'utf8') : null;
    } catch {
        return null;
    }
}

function checkFile(assertion: SpecFileAssertion, context: Judgement): null | string {
    const { scope } = context;
    const target = resolveUnderWorkDir(assertion.path, context);
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

// invariant: the stack is replaced by the run's own line: the runner's frames end in the plugin's generated module.
function failure(run: SpecRun, context: Judgement, details: string[]): Error {
    const error = new Error(
        refusal({
            fix: 'correct the command, or run with TEST_UPDATE=1 to rewrite the runs: the exit code and the streams, and nothing else',
            found: [
                `spec mismatch: ${context.document.description}`,
                '',
                `$ ${run.command}`,
                '',
                details.join('\n\n'),
                '',
                `${context.displayPath}:${run.commandLine}`,
            ].join('\n'),
            read: 'docs/guides/spec-documents.md#failure-and-update',
            why: 'A spec document states what its runs produce: the exit code and the streams, whole.',
        }),
    );
    return atLine(error, context.filePath, run.commandLine);
}

export function atLine(error: Error, filePath: string, line: number): Error {
    error.stack = `${error.name}: ${error.message}\n    at ${filePath}:${line}:1`;
    return error;
}

export function assertRun(outcome: RunOutcome, context: Judgement): void {
    const { actual, run } = outcome;
    const { scope } = context;
    // invariant: an exit-code mismatch is reported alone: the stream diffs are its consequences.
    if (actual.exitCode !== run.exitCode) {
        throw failure(run, context, [
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

    details.push(...filesDetail(outcome, context));

    if (details.length > 0) {
        throw failure(run, context, details);
    }
}

function filesDetail({ run }: RunOutcome, context: Judgement): string[] {
    const fileFailures = run.files
        .map((assertion) => checkFile(assertion, context))
        .filter((line): line is string => line !== null);

    return fileFailures.length === 0
        ? []
        : [['files mismatch', '', ...fileFailures.map((line) => `  ${line}`)].join('\n')];
}

/** The `files:` of a run, judged alone: update mode rewrites a run's exit code and streams, never what the run was asked to leave on disk. */
export function assertFiles(outcome: RunOutcome, context: Judgement): void {
    const details = filesDetail(outcome, context);
    if (details.length > 0) {
        throw failure(outcome.run, context, details);
    }
}

/** Placeholders of the previous golden preserved by pattern (`no-volatile-literal`); an emptied stream loses its key. */
export function updates(outcomes: RunOutcome[], scope: CaptureScope) {
    return outcomes.map(({ actual, run, stderr, stdout }) => ({
        exitCode: actual.exitCode,
        stderr: mergeTextPreservingPlaceholders(run.stderr?.text ?? null, stderr, scope),
        stdout: mergeTextPreservingPlaceholders(run.stdout?.text ?? null, stdout, scope),
    }));
}
