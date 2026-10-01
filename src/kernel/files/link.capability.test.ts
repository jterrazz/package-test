import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { defineAction } from '../chain/action.js';
import { defineFacet } from '../chain/define-facet.js';
import { fsLinks } from './fs-links.adapter.js';
import { link } from './link.capability.js';
import type { LinkMethod } from './link.capability.js';
import { scratchDirectory } from './scratch.js';
import { directory, file } from './spec-path.js';

type Chain = {
    link: LinkMethod<Chain>;
    manifest: (name: string) => Promise<string>;
};

const manifest = defineAction({
    accessors: [],
    name: 'manifest',
    perform: async ([name]: [string], _read, _adapters, { workDir }) =>
        await Promise.resolve(
            readFileSync(resolve(workDir ?? '', 'node_modules', name, 'package.json'), 'utf8'),
        ),
    prepare: () => ({ workDir: scratchDirectory('link-') }),
    row: { group: 'Terminal action', name: '.manifest()', probe: '.manifest(' },
});

function chain(): Chain {
    return defineFacet<Chain>()({
        actions: [manifest],
        capabilities: [link],
        adapters: () => ({ links: fsLinks }),
        locate: () => import.meta.dirname,
        options: {},
    }).open({});
}

describe('link', () => {
    test(".link() — a package the working directory resolves — lands a directory's package under node_modules/<name>", async () => {
        // Given - a package directory beside the test, linked under a scoped name
        const read = await chain()
            .link('@acme/greeter', directory('./_fixtures/greeter/'))
            .manifest('@acme/greeter');

        // Then - the working directory resolves the package by that name
        expect(JSON.parse(read)).toStrictEqual({ name: '@acme/greeter', version: '1.0.0' });
    });

    test.each(['', 'Greeter', '@acme', '../greeter', '.bin', '@acme/greeter/lib'])(
        '.link() — a package the working directory resolves — refuses a name no package carries: %j',
        (name) => {
            // Given - a name that would land outside node_modules/<name>, or nowhere a package can be

            // Then - the setup is refused as it is stated, naming the form to write
            expect(() => chain().link(name)).toThrow(
                /no package name\nwhy: .*\nfix: name it as a package\.json `dependencies` key does/u,
            );
        },
    );

    test('.link() — a package the working directory resolves — refuses one name linked twice', () => {
        // Given - one name, two sources

        // Then - the second is refused: a name resolves to one package
        expect(() =>
            chain().link('@acme/greeter', directory('./_fixtures/greeter/')).link('@acme/greeter'),
        ).toThrow(/link\("@acme\/greeter"\), stated twice on one chain/u);
    });

    test(".link() — a package the working directory resolves — refuses a file where a package's directory is read", () => {
        // Given - a caller handing file() for the source

        // Then - the refusal names directory()
        expect(() =>
            // @ts-expect-error - a file is no package's directory; this line is the guard
            chain().link('@acme/greeter', file('./_fixtures/config.json')),
        ).toThrow(
            /a file where a package's directory is read\n.*\nfix: name the package's directory: link\('@acme\/greeter', directory\('\.\/_fixtures\/greeter\/'\)\)/u,
        );
    });
});
