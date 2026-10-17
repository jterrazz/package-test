import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { refusal } from '../../chain/refusals/refusal.js';
import { resolveSpecPath } from '../../disk/resolved-spec-path.js';
import { diffDirectories, DirectoryAccessor, walkDirectory } from '../disk/directory.js';
import { FilesystemAccessor } from '../disk/filesystem.js';
import { missingHint, shouldUpdateSnapshots } from '../in-place/update.js';
import type { JsonAccessor } from '../text/json.js';
import type { TextAccessor } from '../text/text.js';
import type { CaptureScope } from '../tokens/capture-scope.js';
import { renderExpected, structuralEquals } from '../tokens/structural.js';
import {
    mergePreservingPlaceholders,
    mergeTextPreservingPlaceholders,
} from '../tokens/update-merge.js';
import { formatDirectoryDiff, formatResponseDiff } from './diff.js';
import { compareStreamText, requireExtension } from './text-assertions.js';

export type MatcherResult = {
    message: () => string;
    pass: boolean;
};

export const passed = (label: string): MatcherResult => ({ message: () => label, pass: true });

export const failed = (message: string): MatcherResult => ({ message: () => message, pass: false });

function formatJson(value: unknown): string {
    return `${JSON.stringify(value, null, 4)}\n`;
}

/** `null` for no file, or a whitespace-only one an author creates to be recorded. */
export function recordedGolden(filePath: string): null | string {
    if (!existsSync(filePath)) {
        return null;
    }
    const content = readFileSync(filePath, 'utf8');
    return content.trim() === '' ? null : content;
}

export function matchStreamFile(
    accessor: TextAccessor,
    name: string,
    frozen: boolean,
): MatcherResult {
    requireExtension(name, 'stream');
    const filePath = resolveSpecPath('toMatch', name, accessor.testDir);
    const actual = accessor.text;

    if (shouldUpdateSnapshots() && !frozen) {
        // invariant: update mode writes tokens, not values (`no-volatile-literal`).
        const merged = mergeTextPreservingPlaceholders(
            recordedGolden(filePath),
            actual,
            accessor.captures,
        );
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, merged);
        return passed(`updated ${name}`);
    }

    if (!existsSync(filePath)) {
        return failed(
            `${accessor.streamName} fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    return compareStreamText(accessor, name, readFileSync(filePath, 'utf8'));
}

export function matchJsonFile(
    accessor: JsonAccessor,
    name: string,
    frozen: boolean,
): MatcherResult {
    requireExtension(name, 'json');
    const filePath = resolveSpecPath('toMatch', name, accessor.testDir);
    const actual = accessor.value;

    if (shouldUpdateSnapshots() && !frozen) {
        const merged = mergePreservingPlaceholders(
            JSON.parse(recordedGolden(filePath) ?? 'null'),
            actual,
            accessor.captures.workdir,
        );
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, formatJson(merged));
        return passed(`updated ${name}`);
    }

    if (!existsSync(filePath)) {
        return failed(
            `JSON fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    // Stryker disable next-line StringLiteral: a file read as a Buffer parses as the same text
    const expected: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (structuralEquals(expected, actual, accessor.captures)) {
        return passed(`expected JSON not to match ${name}`);
    }
    return failed(formatResponseDiff(name, renderExpected(expected), actual));
}

type Tree = { captures: CaptureScope; root: string; testDir: string };

async function matchTreeFile(
    { captures: scope, root: actualRoot, testDir }: Tree,
    name: string,
    frozen: boolean,
): Promise<MatcherResult> {
    const fixtureDir = resolveSpecPath('toMatch', name, testDir);

    if (shouldUpdateSnapshots() && !frozen) {
        const previousContents = new Map<string, string>();
        for (const file of await walkDirectory(fixtureDir)) {
            previousContents.set(file, readFileSync(resolve(fixtureDir, file), 'utf8'));
        }
        rmSync(fixtureDir, { force: true, recursive: true });
        mkdirSync(fixtureDir, { recursive: true });
        cpSync(actualRoot, fixtureDir, { recursive: true });
        for (const file of await walkDirectory(fixtureDir)) {
            const previous = previousContents.get(file) ?? null;
            const actual = readFileSync(resolve(fixtureDir, file), 'utf8');
            writeFileSync(
                resolve(fixtureDir, file),
                mergeTextPreservingPlaceholders(previous, actual, scope),
            );
        }
        return passed(`updated ${name}`);
    }

    if (!existsSync(fixtureDir)) {
        return failed(
            `Directory fixture "${name}" does not exist at ${fixtureDir}.\n${missingHint(frozen)}`,
        );
    }

    const diff = await diffDirectories(fixtureDir, actualRoot, { scope });
    if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
        return passed(`expected directory not to match ${name}`);
    }

    return failed(formatDirectoryDiff(name, diff, 'Run with TEST_UPDATE=1 to update the fixture.'));
}

export async function matchDirectoryGolden(
    received: unknown,
    path: string,
    frozen: boolean,
): Promise<MatcherResult> {
    if (received instanceof FilesystemAccessor) {
        return await matchTreeFile(
            { captures: received.captures, root: received.cwd, testDir: received.testDir },
            path,
            frozen,
        );
    }
    if (received instanceof DirectoryAccessor) {
        return await matchTreeFile(received, path, frozen);
    }
    throw new TypeError(
        refusal('one-verb-per-meaning', {
            fix: `compare result.filesystem or result.directory(...) to directory(${JSON.stringify(path)}); a text is compared to file(...)`,
            found: `toMatch(directory(${JSON.stringify(path)})) on a subject that is no tree`,
        }),
    );
}
