import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** An `@ts-expect-error` passes on any error, so each marker ends on the compiler's own words, checked against the file compiled without its markers. */

export type TypeRow = {
    expected: string;
    id: string;
    /** The line after the marker. */
    line: number;
    reason: string;
};

/** `// @ts-expect-error <row name> — <reason> [`<words>`]`. */
const ROW = /\/\/ @ts-expect-error (?<id>[a-z][a-z-]+) — (?<reason>.+?) \[`(?<expected>.+)`\]\s*$/u;

const MARKER = /\/\/ @ts-expect-error\b/u;

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

export type Refusal = { code: string; line: number; message: string };

const ERROR_LINE = /^(?<file>.+)\((?<line>\d+),\d+\): error (?<code>TS\d+): (?<message>.*)$/u;

/** The indented lines below an error are joined into its message, so a row may name the reason the compiler gives below its first sentence. */
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

/** Compiled in a scratch project extending the repository's tsconfig, relative imports rewritten to `srcDir`. */
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
