import { describe, expect, test } from 'vitest';

import { link } from './link.capability.js';
import type { LinkPort } from './link.port.js';
import { directory, file } from './spec-path.js';

type Linked = Parameters<typeof link.reduce>[0];

const CHAPTER = 'read: docs/guides/cli-specs.md#link--a-package-the-working-directory-resolves';

/** A port that logs each link it lays. */
function linksInto(log: string[]): LinkPort {
    return {
        link: (name, path, testDir, workDir) => {
            log.push(`${name} ${String(path)} ${testDir} ${workDir}`);
        },
    };
}

const SETUP = { adapters: { links: linksInto([]) }, config: {} };

/** The slice the chain holds after each `.link()` call, in order. */
function linked(...calls: [unknown, unknown?][]): Linked {
    let slice = link.initial;
    for (const args of calls) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an untyped call is what the refusals are for, and the overloads refuse it at every typed site
        slice = link.reduce(slice, args as Parameters<typeof link.reduce>[1], SETUP);
    }
    return slice;
}

function refusalOf(work: () => unknown): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

function noDirectory(name: string, handed: string): string {
    return [
        `found: link('${name}', ${handed}`,
        'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
        `fix: name the package's directory: link('${name}', directory('./_fixtures/greeter/'))`,
        'read: docs/reference/linting.md#disk-named-by-relative-path-at-runtime',
    ].join('\n');
}

describe('link', () => {
    test('link.capability — .link() — gathers each package, from the project or from the directory named', () => {
        // Given - a bare scoped name, and a plain name read from a fixture directory
        // Then - each in the order stated
        expect(
            linked(['@acme/greeter'], ['greeter-2', directory('./_fixtures/greeter/')]),
        ).toStrictEqual([
            { name: '@acme/greeter', path: null },
            { name: 'greeter-2', path: './_fixtures/greeter/' },
        ]);
    });

    test('link.capability — .link() — refuses what no package is named, and a name stated twice', () => {
        // Given - names npm refuses, and one stated twice
        const noName = (name: unknown): string =>
            [
                `found: link(${JSON.stringify(name)}), no package name`,
                'why: The name is where the package lands, `node_modules/<name>`, and what the binary imports it by.',
                "fix: name it as a package.json `dependencies` key does: link('@scope/name') or link('name')",
                CHAPTER,
            ].join('\n');

        // Then - each refusal whole
        expect([
            refusalOf(() => linked(['greeTer'])),
            refusalOf(() => linked(['@acme'])),
            refusalOf(() => linked(['./greeter'])),
            refusalOf(() => linked([42])),
            refusalOf(() => linked(['greeter'], ['greeter'])),
        ]).toStrictEqual([
            noName('greeTer'),
            noName('@acme'),
            noName('./greeter'),
            noName(42),
            [
                'found: link("greeter"), stated twice on one chain',
                'why: A name resolves to one package: a second link of it would silently replace the first.',
                'fix: link greeter once, from the one source the binary should resolve',
                CHAPTER,
            ].join('\n'),
        ]);
    });

    test('link.capability — .link() — refuses a source that is no directory, naming the folder a fixture would be', () => {
        // Given - a file, a bare string and a number where a directory goes
        // Then - each refusal whole, a scope dropped from the folder
        expect([
            refusalOf(() => linked(['@acme/greeter', file('./_fixtures/config.json')])),
            refusalOf(() => linked(['greeter', './greeter/'])),
            refusalOf(() => linked(['@acme/greeter', 7])),
        ]).toStrictEqual([
            noDirectory(
                '@acme/greeter',
                `file("./_fixtures/config.json")), a file where a package's directory is read`,
            ),
            noDirectory('greeter', `"./greeter/"), a value where a package's directory is read`),
            noDirectory('@acme/greeter', `number), a value where a package's directory is read`),
        ]);
    });

    test('link.capability — arming — lays each package in the working directory, and none when the chain has none', async () => {
        // Given - two packages gathered
        const log: string[] = [];
        const slice = linked(['@acme/greeter'], ['greeter-2', directory('./_fixtures/greeter/')]);

        // When - a chain with a working directory arms, then one without
        await link.arm?.(
            slice,
            { links: linksInto(log) },
            { config: {}, testDir: '/spec', workDir: '/work' },
        );
        await link.arm?.(
            slice,
            { links: linksInto(log) },
            { config: {}, testDir: '/spec', workDir: null },
        );

        // Then - each laid once, from the spec's folder into the working directory
        expect(log).toStrictEqual([
            '@acme/greeter null /spec /work',
            'greeter-2 ./_fixtures/greeter/ /spec /work',
        ]);
    });
});
