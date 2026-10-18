import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

const READ = 'read: docs/guides/cli-specs.md#link-a-package-the-working-directory-resolves';

describe('refused', () => {
    test('a bare name no node_modules above the spec holds is refused before the binary runs', async () => {
        // Given - a package the project never installed
        const run = cli.link('@acme/absent').exec('package @acme/absent');

        // Then - the refusal says where it looked, and the directory form
        await expect(run).rejects.toThrow(
            /found: link\('@acme\/absent'\): no node_modules from .*specs\/cli\/link up holds @acme\/absent\n.*\nfix: install @acme\/absent in the project the spec belongs to, or name the package's directory/u,
        );
    });

    test.each(['', 'Greeter', '@acme', '../greeter', '.bin', '@acme/greeter/lib'])(
        'a name no package carries, %j, is refused as it is stated',
        (name) => {
            // Given - a name no package.json `dependencies` key could hold
            // Then - the chain refuses it before anything runs, naming the two forms of a package name
            expect(() => cli.link(name)).toThrow(
                [
                    `found: link(${JSON.stringify(name)}), no package name`,
                    'why: The name is where the package lands, `node_modules/<name>`, and what the binary imports it by.',
                    "fix: name it as a package.json `dependencies` key does: link('@scope/name') or link('name')",
                    READ,
                ].join('\n'),
            );
        },
    );

    test('one name linked twice on one chain is refused, rather than the second silently replacing the first', () => {
        // Given - the same package linked from the same source, twice
        const once = cli.link('@acme/greeter', directory('./__fixtures__/greeter/'));

        // Then - the second statement is refused
        expect(() => once.link('@acme/greeter', directory('./__fixtures__/greeter/'))).toThrow(
            [
                'found: link("@acme/greeter"), stated twice on one chain',
                'why: A name resolves to one package: a second link of it would silently replace the first.',
                'fix: link @acme/greeter once, from the one source the binary should resolve',
                READ,
            ].join('\n'),
        );
    });

    test("a file where a package's directory is read is refused, naming the directory form", () => {
        // Given - the package's manifest named in place of its folder
        // Then - refused, with the call to write instead
        expect(() =>
            // @ts-expect-error -- a source the types refuse, refused at run time too
            cli.link('@acme/greeter', file('./__fixtures__/greeter/package.json')),
        ).toThrow(
            [
                "found: link('@acme/greeter', file(\"./__fixtures__/greeter/package.json\")), a file where a package's directory is read",
                'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
                "fix: name the package's directory: link('@acme/greeter', directory('./__fixtures__/greeter/'))",
                'read: docs/reference/linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
        );
    });
});
