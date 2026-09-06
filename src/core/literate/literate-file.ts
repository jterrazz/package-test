/**
 * Parser / serializer for `<case>.cli` literate spec files.
 *
 * A literate spec is ONE scenario in one file: a header of `key: value` lines
 * (the narrative and the ground the run stands on), a blank line, then one or
 * more `$ <argv>` blocks holding the expected exit code and streams.
 *
 *     test: refuses to guess when it is run outside the checkout
 *     given: a workdir with no home/ + apps/ pair anywhere above it
 *     then: the error names where the command has to be run
 *     fixture: $FIXTURES/repositories-stub/
 *     env: frozen TERRA_ORIGIN=http://127.0.0.1:9
 *     serve: mcp MCP_STUB_WITHHOLD=get-article
 *
 *     $ terra git repositories
 *     exit: 1
 *     --- stderr
 *     Error: no directory with home/ and apps/ above the current directory
 *
 * The shape mirrors the `.http` grammar (a start section, then a body split at
 * the first blank line) so a reader who knows one knows the other. The parser
 * is pure text: it resolves nothing, runs nothing, and knows no filesystem.
 */

// ── Types ──

/** One `KEY=value` (or a bare word naming a registered env set) from an `env:` line. */
export type LiterateEnvToken =
    | { key: string; kind: 'pair'; value: string }
    | { kind: 'set'; name: string };

/** One `serve:` line — a registered server name plus the extra env it is started with. */
export interface LiterateServeEntry {
    env: Record<string, string>;
    line: number;
    name: string;
}

/**
 * The header of a literate spec — everything before the first blank line.
 *
 * The field names ARE the grammar keys, `then:` included: a reader must be able
 * to move between the file and this type without a translation table. The
 * thenable hazard the linter guards is not reachable here — a header is data
 * read out of a `LiterateSpec`, never a value the framework awaits.
 */
// eslint-disable-next-line unicorn/no-thenable
export interface LiterateHeader {
    /** `env:` lines, flattened to their tokens in declaration order. */
    env: LiterateEnvToken[];
    /** `fixture:` paths, in declaration order (they layer). */
    fixtures: string[];
    given: string;
    /** `serve:` lines, in declaration order. */
    serve: LiterateServeEntry[];
    /** The vitest test title. */
    test: string;
    then: string;
}

/** One `$ <argv>` block: the command, its exit code, and both streams verbatim. */
export interface LiterateBlock {
    /** The command line, exactly as written after `$ ` (may be empty). */
    argv: string;
    exitCode: number;
    /** 1-based line of the `$ ` line in the source file. */
    line: number;
    /** Expected stderr; `null` when the block declares no `--- stderr` section. */
    stderr: null | string;
    /** Expected stdout, verbatim (no trailing newline). */
    stdout: string;
}

/** A parsed `<case>.cli` file. */
export interface LiterateSpec {
    blocks: LiterateBlock[];
    header: LiterateHeader;
    /** The header text verbatim, including its trailing blank line — never rewritten. */
    headerText: string;
}

// ── Grammar ──

/** The closed set of header keys. Anything else is an error naming the line. */
export const HEADER_KEYS = ['test', 'given', 'then', 'fixture', 'env', 'serve'] as const;

/** The separator opening a block's stderr section. */
export const STDERR_MARKER = '--- stderr';

const HEADER_LINE = /^(?<key>[a-z]+):(?<value>.*)$/;
const EXIT_LINE = /^exit:\s*(?<code>-?\d+)\s*$/;
const KEY_SET = new Set<string>(HEADER_KEYS);

/**
 * What a malformed `.cli` file broke — the two static rules the format is
 * bound by. `narrative` is B4's (the three mandatory lines a test narrates
 * itself with); `shape` is D4b's (the closed header keys, the `$` block, the
 * `exit:` that follows it).
 */
export type LiterateDefect = 'narrative' | 'shape';

/** A refusal from the grammar, carrying where it happened and which rule it is. */
export class LiterateSyntaxError extends Error {
    readonly defect: LiterateDefect;
    readonly line: number;

    constructor(fileName: string, line: number, message: string, defect: LiterateDefect) {
        super(`${fileName}:${line}: ${message}`);
        this.defect = defect;
        this.line = line;
        this.name = 'LiterateSyntaxError';
    }
}

function fail(
    fileName: string,
    line: number,
    message: string,
    defect: LiterateDefect = 'shape',
): never {
    throw new LiterateSyntaxError(fileName, line, message, defect);
}

/** Is this line the start of a block? `$ cmd`, or a bare `$` (no arguments). */
function isBlockStart(line: string): boolean {
    return line === '$' || line.startsWith('$ ');
}

function parseEnvTokens(value: string, fileName: string, line: number): LiterateEnvToken[] {
    const tokens: LiterateEnvToken[] = [];
    for (const token of value.split(/\s+/).filter((part) => part.length > 0)) {
        const separator = token.indexOf('=');
        if (separator === -1) {
            tokens.push({ kind: 'set', name: token });
            continue;
        }
        const key = token.slice(0, separator);
        if (key.length === 0) {
            fail(fileName, line, `env: "${token}" has no variable name before the "="`);
        }
        tokens.push({ key, kind: 'pair', value: token.slice(separator + 1) });
    }
    if (tokens.length === 0) {
        fail(fileName, line, 'env: needs at least one KEY=value pair or a registered env-set name');
    }
    return tokens;
}

function parseServeEntry(value: string, fileName: string, line: number): LiterateServeEntry {
    const parts = value.split(/\s+/).filter((part) => part.length > 0);
    const name = parts.shift();
    if (name === undefined) {
        fail(fileName, line, 'serve: needs the name of a server registered in specification.cli()');
    }
    if (name.includes('=')) {
        fail(fileName, line, `serve: "${name}" is a KEY=value pair — the server NAME comes first`);
    }
    const env: Record<string, string> = {};
    for (const part of parts) {
        const separator = part.indexOf('=');
        if (separator <= 0) {
            fail(fileName, line, `serve: "${part}" is not a KEY=value pair`);
        }
        env[part.slice(0, separator)] = part.slice(separator + 1);
    }
    return { env, line, name };
}

/**
 * Parse the header: every line up to the first blank one. `#` lines are
 * comments; `test:`, `given:` and `then:` are mandatory and single; `fixture:`,
 * `env:` and `serve:` repeat and keep their declaration order.
 */
function parseHeader(lines: string[], fileName: string): { header: LiterateHeader; end: number } {
    const fixtures: string[] = [];
    const env: LiterateEnvToken[] = [];
    const serve: LiterateServeEntry[] = [];
    const singles = new Map<string, string>();

    let index = 0;
    for (; index < lines.length; index++) {
        const raw = lines[index];
        if (raw.trim() === '') {
            break;
        }
        const number = index + 1;
        if (raw.trimStart().startsWith('#')) {
            continue;
        }
        if (isBlockStart(raw)) {
            fail(
                fileName,
                number,
                'a "$" block starts before the header is closed — separate the header from the blocks with a blank line',
            );
        }
        const found = HEADER_LINE.exec(raw);
        if (!found?.groups) {
            fail(
                fileName,
                number,
                `"${raw}" is not a header line — expected "<key>: <value>" (keys: ${HEADER_KEYS.join(', ')})`,
            );
        }
        const key = found.groups.key;
        const value = found.groups.value.trim();
        if (!KEY_SET.has(key)) {
            fail(
                fileName,
                number,
                `unknown header key "${key}:" — known keys: ${HEADER_KEYS.join(', ')}`,
            );
        }
        if (key === 'fixture' || key === 'env' || key === 'serve') {
            if (value.length === 0) {
                fail(fileName, number, `${key}: is empty`);
            }
            if (key === 'fixture') {
                fixtures.push(value);
            } else if (key === 'env') {
                env.push(...parseEnvTokens(value, fileName, number));
            } else {
                serve.push(parseServeEntry(value, fileName, number));
            }
            continue;
        }
        if (singles.has(key)) {
            fail(fileName, number, `${key}: is declared twice — it takes exactly one line`);
        }
        if (value.length === 0) {
            fail(fileName, number, `${key}: is empty`);
        }
        singles.set(key, value);
    }

    for (const key of ['test', 'given', 'then']) {
        if (!singles.has(key)) {
            fail(
                fileName,
                1,
                `missing "${key}:" in the header — test, given and then are mandatory`,
                'narrative',
            );
        }
    }

    const header: LiterateHeader = {
        env,
        fixtures,
        given: singles.get('given')!,
        serve,
        test: singles.get('test')!,
        // The header's field names are the grammar keys — see {@link LiterateHeader}.
        // eslint-disable-next-line unicorn/no-thenable
        then: singles.get('then')!,
    };
    return { end: index, header };
}

/**
 * Split a block's stream section at `--- stderr`, dropping the ONE blank line
 * that separates the block from the next `$` (that line belongs to the
 * separator, not to the stream).
 */
function parseStreams(
    section: string[],
    trailingSeparator: boolean,
): Pick<LiterateBlock, 'stderr' | 'stdout'> {
    const lines = [...section];
    if (trailingSeparator && lines.at(-1) === '') {
        lines.pop();
    }
    const marker = lines.indexOf(STDERR_MARKER);
    if (marker === -1) {
        return { stderr: null, stdout: lines.join('\n') };
    }
    return {
        stderr: lines.slice(marker + 1).join('\n'),
        stdout: lines.slice(0, marker).join('\n'),
    };
}

/** Parse the blocks: everything after the header's blank line. */
function parseBlocks(lines: string[], start: number, fileName: string): LiterateBlock[] {
    const starts: number[] = [];
    for (let index = start; index < lines.length; index++) {
        if (isBlockStart(lines[index])) {
            starts.push(index);
        }
    }
    if (starts.length === 0) {
        fail(
            fileName,
            start + 1,
            'no "$ <command>" block — a literate spec runs at least one command',
        );
    }
    for (let index = start; index < starts[0]; index++) {
        if (lines[index].trim() !== '') {
            fail(
                fileName,
                index + 1,
                `"${lines[index]}" sits outside a block — the first line after the header must be "$ <command>"`,
            );
        }
    }

    return starts.map((blockStart, position) => {
        const next = starts[position + 1] ?? lines.length;
        const argv = lines[blockStart].slice(1).trim();
        const exitLine = lines[blockStart + 1];
        const exit = exitLine === undefined ? null : EXIT_LINE.exec(exitLine);
        if (!exit?.groups) {
            fail(
                fileName,
                blockStart + 2,
                `the line after "$ ${argv}" must be "exit: <integer>", got ${exitLine === undefined ? '(end of file)' : `"${exitLine}"`}`,
            );
        }
        const streams = parseStreams(
            lines.slice(blockStart + 2, next),
            position + 1 < starts.length,
        );
        return {
            argv,
            exitCode: Number(exit.groups.code),
            line: blockStart + 1,
            stderr: streams.stderr,
            stdout: streams.stdout,
        };
    });
}

/**
 * Parse a `<case>.cli` file. `fileName` is used verbatim in error messages, so
 * pass the path the reader would open (`specs/cli/no-estate.cli`).
 */
export function parseLiterateFile(content: string, fileName: string): LiterateSpec {
    const body = content.replace(/\r\n/g, '\n').replace(/\n$/, '');
    const lines = body.split('\n');
    const { end, header } = parseHeader(lines, fileName);
    return {
        blocks: parseBlocks(lines, end + 1, fileName),
        header,
        headerText: `${lines.slice(0, end).join('\n')}\n`,
    };
}

/** Render one block back to its source form (the update-mode inverse of the parser). */
export function serializeLiterateBlock(block: LiterateBlock): string {
    const lines = [`$ ${block.argv}`.trimEnd(), `exit: ${block.exitCode}`];
    if (block.stdout.length > 0) {
        lines.push(block.stdout);
    }
    if (block.stderr !== null && block.stderr.length > 0) {
        lines.push(STDERR_MARKER, block.stderr);
    }
    return lines.join('\n');
}

/**
 * Rebuild a `.cli` file from its VERBATIM header text and a fresh set of
 * blocks. Update mode rewrites only what follows each `$` — the header comes
 * back byte-identical, comments and all.
 */
export function serializeLiterateFile(headerText: string, blocks: LiterateBlock[]): string {
    return `${headerText}\n${blocks.map((block) => serializeLiterateBlock(block)).join('\n\n')}\n`;
}
