import { readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { defineAction } from '../../../kernel/chain/action.js';
import { defineFacet } from '../../../kernel/chain/define-facet.js';
import { scratchDirectory } from '../../../kernel/files/scratch.js';
import { directory, file } from '../../../kernel/files/spec-path.js';
import { fixture } from './fixture.capability.js';
import type { FixtureMethod } from './fixture.capability.js';
import { fsFixtures } from './fixtures.engine.js';

/** A chain composed of `.fixture()` alone, ending on what its working directory holds. */
type Chain = { fixture: FixtureMethod<Chain>; list: () => Promise<string[]> };

const list = defineAction({
    accessors: [],
    name: 'list',
    perform: async (_args: [], _read, _engines, { workDir }) =>
        await Promise.resolve(readdirSync(workDir ?? '').toSorted()),
    prepare: () => ({ workDir: scratchDirectory('fixture-') }),
    row: { group: 'Terminal action', name: '.list()', probe: '.list(' },
});

/** A chain whose fixtures are laid on this disk, its paths read from this folder. */
function chain(): Chain {
    return defineFacet<Chain>()({
        actions: [list],
        capabilities: [fixture],
        engines: () => ({ workdir: fsFixtures }),
        locate: () => import.meta.dirname,
        options: {},
    }).open({});
}

describe('fixture', () => {
    test('.fixture() — the file state a chain stands on — refuses a bare string where the disk is read, naming the wrapper', () => {
        // Given - a caller the compiler does not see, handing a path as a value

        // Then - the setup is refused as it is stated, and names file() and directory()
        expect(() => chain().fixture('./fixtures/shop/' as never)).toThrow(
            /^found: fixture\("\.\/fixtures\/shop\/"\), a value where the disk is read\n.*\nfix: name the disk: fixture\(file/u,
        );
    });

    test(".fixture() — the file state a chain stands on — spreads a directory's contents and copies a file under its own name, in order", async () => {
        // Given - a directory and a file this test stands on
        const laid = await chain()
            .fixture(directory('./fixtures/shop/'))
            .fixture(file('./fixtures/config.json'))
            .list();

        // Then - the directory's file and the file itself, side by side in the working directory
        expect(laid).toStrictEqual(['config.json', 'index.txt']);
    });

    test('.fixture() — the file state a chain stands on — refuses a path naming the other kind on disk than it says', async () => {
        // Given - a file named as a directory, and a directory named as a file

        // Then - each is refused when the chain is armed, with the kind on disk
        // checker-disable-next-line c8 -- the kind on disk is the refusal under test: each path names the other kind on purpose
        await expect(chain().fixture(directory('./fixtures/config.json/')).list()).rejects.toThrow(
            /names a file\n.*\nfix: drop the \//u,
        );
        // checker-disable-next-line c8 -- the kind on disk is the refusal under test: each path names the other kind on purpose
        await expect(chain().fixture(file('./fixtures/shop')).list()).rejects.toThrow(
            /names a directory\n.*\nfix: end its path in \//u,
        );
    });
});
