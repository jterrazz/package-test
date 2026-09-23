import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The type channel's rows, held to the error each one is written FOR.
 *
 * An `@ts-expect-error` passes on ANY error: a row refusing a bare string
 * where a file is meant kept passing the day the verb itself was renamed,
 * because a call to a method that does not exist is an error too. So every
 * marker of `src/type-channel.test-d.ts` ends on the compiler's own words in
 * brackets, and this module compiles the file with the markers taken out and
 * reads what the compiler says on the line each one marks.
 */

/** One row: the marker's line, its id and reason, and the words its error must carry. */
export type TypeRow = {
    /** The words the compiler's message on the marked line must contain. */
    expected: string;
    id: string;
    /** 1-based line of the code the marker covers (the line after it). */
    line: number;
    reason: string;
};

/** A marker that states its row: `// @ts-expect-error <ID> — <reason> [`<words>`]`. */
const ROW = /\/\/ @ts-expect-error (?<id>[A-Z]\d+) — (?<reason>.+?) \[`(?<expected>.+)`\]\s*$/u;

/** Any `@ts-expect-error` marker, stated or not. */
const MARKER = /\/\/ @ts-expect-error\b/u;

/** Every marker of the file, and the ones that do not state their row. */
export function typeRowsOf(source: string): { rows: TypeRow[]; unstated: number[] } {
    const rows: TypeRow[] = [];
    const unstated: number[] = [];
    for (const [index, text] of source.split('\n').entries()) {
        if (!MARKER.test(text)) {
            continue;
        }
        const groups = ROW.exec(text)?.groups;
        if (
            groups?.id === undefined ||
            groups.reason === undefined ||
            groups.expected === undefined
        ) {
            unstated.push(index + 1);
            continue;
        }
        rows.push({
            expected: groups.expected,
            id: groups.id,
            line: index + 2,
            reason: groups.reason,
        });
    }
    return { rows, unstated };
}

/** One compiler error: where, which code, and its message — the lines that elaborate it included. */
export type Refusal = { code: string; line: number; message: string };

/** `file(line,col): error TSxxxx: message`, as `tsc --pretty false` prints it. */
const ERROR_LINE = /^(?<file>.+)\((?<line>\d+),\d+\): error (?<code>TS\d+): (?<message>.*)$/u;

/**
 * The errors `tsc --pretty false` printed about the scratch file: an error
 * line, then the indented lines elaborating it (which overload failed, which
 * property), joined into one message so a row may name the reason the
 * compiler gives below its first sentence.
 */
function readRefusals(output: string): Refusal[] {
    const refusals: Refusal[] = [];
    let current: Refusal | undefined;
    for (const text of output.split('\n')) {
        const groups = ERROR_LINE.exec(text)?.groups;
        if (groups?.file !== undefined && groups.code !== undefined && groups.line !== undefined) {
            current = groups.file.endsWith('channel.ts')
                ? { code: groups.code, line: Number(groups.line), message: groups.message ?? '' }
                : undefined;
            if (current !== undefined) {
                refusals.push(current);
            }
        } else if (current !== undefined && text.startsWith(' ')) {
            current.message += ` ${text.trim()}`;
        }
    }
    return refusals;
}

/**
 * What the compiler says about `source` once its markers are gone.
 *
 * The file is compiled in a scratch project that extends the repository's own
 * tsconfig, so it is judged under the options it is judged under in `lint`;
 * its relative imports are rewritten to `srcDir`, where it lives.
 */
export function refusalsOf(options: {
    cacheDir: string;
    source: string;
    srcDir: string;
    tsconfig: string;
    tscBin: string;
}): Refusal[] {
    const { cacheDir, source, srcDir, tsconfig, tscBin } = options;
    const dir = mkdtempSync(join(cacheDir, 'type-channel-'));
    try {
        const stripped = source
            .replaceAll(/\/\/ @ts-expect-error[^\n]*/gu, '//')
            .replaceAll(
                /from '\.\/(?<path>[^']+)'/gu,
                (_, path: string) => `from '${resolve(srcDir, path)}'`,
            );
        writeFileSync(join(dir, 'channel.ts'), stripped);
        writeFileSync(
            join(dir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: { noEmit: true },
                extends: tsconfig,
                include: ['channel.ts'],
            }),
        );
        const run = spawnSync(process.execPath, [tscBin, '--project', dir, '--pretty', 'false'], {
            encoding: 'utf8',
        });
        const output = `${run.stdout}${run.stderr}`;
        return readRefusals(output);
    } finally {
        rmSync(dir, { force: true, recursive: true });
    }
}
