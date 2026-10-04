import { describe, expect, test } from 'vitest';

import {
    directory,
    file,
    isDiskDirectory,
    isDiskFile,
    isDiskTarget,
    requireDiskFile,
    requireDiskTarget,
    requireRelativePath,
} from './spec-path.js';

/** The found, fix and read lines of what the call throws, or nothing when it throws nothing. */
function refusalOf(call: () => unknown): string[] {
    try {
        call();
        return [];
    } catch (error) {
        const lines = error instanceof Error ? error.message.split('\n') : [];
        return [
            lines[0] ?? '',
            lines.find((line) => line.startsWith('fix: ')) ?? '',
            lines.at(-1) ?? '',
        ];
    }
}

/** Past the compiler, as a caller without types writes it. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a caller without types hands any value, which the compiler would refuse
const untyped = (value: unknown): never => value as never;

describe('spec-path', () => {
    test('file() and directory() — a relative path names the disk, branded by its kind, frozen', () => {
        // Given - a file and a directory named from the spec file
        const named = file('./_fixtures/shop/index.txt');
        const folder = directory('../disk/_fixtures/');

        // Then - each value as named, recognised for its kind alone, and frozen
        expect([
            named.path,
            folder.path,
            [isDiskFile(named), isDiskDirectory(named), isDiskTarget(named)],
            [isDiskFile(folder), isDiskDirectory(folder), isDiskTarget(folder)],
            [
                null,
                'x',
                { path: './a' },
                { [Symbol.for('@jterrazz/test:disk')]: 'other' },
                { [Symbol.for('@jterrazz/test:disk')]: 'file' },
            ].map((value) => isDiskTarget(value)),
            Object.isFrozen(named),
        ]).toStrictEqual([
            './_fixtures/shop/index.txt',
            '../disk/_fixtures/',
            [true, false, true],
            [false, true, true],
            [false, false, false, false, true],
            true,
        ]);
    });

    test('file() and directory() — a path that is not relative is refused naming the relative form to write', () => {
        // Given - paths absolute, bare, of another type, of slashes alone, and slashes within
        // Then - each refusal's finding and fix
        expect([
            refusalOf(() => file(untyped('/abs/out.txt'))),
            refusalOf(() => file(untyped('out.txt'))),
            refusalOf(() => file(untyped(5))),
            refusalOf(() => file(untyped('///'))),
            refusalOf(() => directory(untyped('fixtures/'))),
            refusalOf(() => {
                requireRelativePath('seed', '//x/rows.sql');
            }),
            refusalOf(() => {
                requireRelativePath('seed', 'x//rows.sql');
            }),
        ]).toStrictEqual([
            [
                'found: file("/abs/out.txt"), a path that is not relative to the spec file',
                "fix: start it with ./ or ../, from the spec file: file('./abs/out.txt')",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: file("out.txt"), a path that is not relative to the spec file',
                "fix: start it with ./ or ../, from the spec file: file('./out.txt')",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: file(5), a path that is not relative to the spec file',
                "fix: start it with ./ or ../, from the spec file: file('./_expected/output.txt')",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: file("///"), a path that is not relative to the spec file',
                "fix: start it with ./ or ../, from the spec file: file('./_expected/output.txt')",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: directory("fixtures/"), a path that is not relative to the spec file',
                "fix: start it with ./ or ../, from the spec file: directory('./fixtures/')",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: seed("//x/rows.sql"), a path that is not relative to the spec file',
                "fix: start it with ./ or ../, from the spec file: seed('./x/rows.sql')",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: seed("x//rows.sql"), a path that is not relative to the spec file',
                "fix: start it with ./ or ../, from the spec file: seed('./x//rows.sql')",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
        ]);
    });

    test('a disk value read as a pattern — is refused, naming the wrapper that goldens a string', () => {
        // Given - a file and a directory handed where a pattern is read
        // Then - each refusal
        expect([
            refusalOf(() => 'text'.match(untyped(file('./_fixtures/config.json')))),
            refusalOf(() => 'text'.match(untyped(directory('./_fixtures/shop/')))),
        ]).toStrictEqual([
            [
                'found: toMatch(file("./_fixtures/config.json")) on a string, a value with no golden',
                "fix: wrap the string to golden it — `expect(text(value)).toMatch(file(…))` — or compare it to a value, `toMatch('…')`",
                'read: docs/24-linting.md#one-verb-per-meaning',
            ],
            [
                'found: toMatch(directory("./_fixtures/shop/")) on a string, a value with no golden',
                "fix: wrap the string to golden it — `expect(text(value)).toMatch(directory(…))` — or compare it to a value, `toMatch('…')`",
                'read: docs/24-linting.md#one-verb-per-meaning',
            ],
        ]);
    });

    test('requireDiskFile — hands back the file it reads, and refuses a directory, a value or a file of another kind, the example the verb’s', () => {
        // Given - a file of each kind, a directory, and plain values
        const json = file('./_fixtures/config.json');

        // Then - each answer
        expect([
            requireDiskFile('fixture', json, '.json') === json,
            refusalOf(() => requireDiskFile('fixture', directory('./_fixtures/shop/'))),
            refusalOf(() => requireDiskFile('request', 'create.http')),
            refusalOf(() => requireDiskFile('seed', 5)),
            refusalOf(() => requireDiskFile('run', json, '.spec.yaml')),
            refusalOf(() => requireDiskFile('toMatch', json, '.txt')),
            refusalOf(() => requireDiskFile('toMatch', 'x')),
            refusalOf(() => requireDiskFile('seed', { rows: 1 })),
        ]).toStrictEqual([
            true,
            [
                'found: fixture(directory("./_fixtures/shop/")), a directory where one file is read',
                "fix: name one file: fixture(file('./_fixtures/config.json'))",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: request("create.http"), a value where a file is read',
                "fix: name one file: request(file('./_requests/create.http'))",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: seed(5), a value where a file is read',
                "fix: name one file: seed(file('./_seeds/rows.sql'))",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: run(file("./_fixtures/config.json")), a file not ending in .spec.yaml',
                "fix: name the .spec.yaml file run() reads: run(file('./case.spec.yaml'))",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: toMatch(file("./_fixtures/config.json")), a file not ending in .txt',
                "fix: name the .txt file toMatch() reads: toMatch(file('./_expected/output.txt'))",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: toMatch("x"), a value where a file is read',
                "fix: name one file: toMatch(file('./_expected/output.txt'))",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: seed([object Object]), a value where a file is read',
                "fix: name one file: seed(file('./_seeds/rows.sql'))",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
        ]);
    });

    test('requireDiskTarget — hands back a file or a directory, and refuses any other value', () => {
        // Given - a file, and a plain value
        const json = file('./_fixtures/config.json');

        // Then - the file, and the refusal naming both forms
        expect([
            requireDiskTarget('run', json) === json,
            refusalOf(() => requireDiskTarget('docker', 'x')),
        ]).toStrictEqual([
            true,
            [
                'found: docker("x"), a value where the disk is read',
                "fix: name the disk: docker(file('./…')) for a file, docker(directory('./…/')) for a directory",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
        ]);
    });

    test('file() and directory() — a file ending in / and a directory that does not are refused naming the other', () => {
        // Given - a file named with slashes at its end, and a directory with none
        // Then - each refusal
        expect([
            refusalOf(() => file(untyped('./out//'))),
            refusalOf(() => directory(untyped('./fixtures'))),
        ]).toStrictEqual([
            [
                'found: file("./out//"), a path ending in / — a directory\'s',
                'fix: name the directory with directory("./out//"), or the file without its /: file("./out")',
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
            [
                'found: directory("./fixtures"), a path that does not end in /',
                'fix: end it in /: directory("./fixtures/"), or name a file with file("./fixtures")',
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ],
        ]);
    });
});
