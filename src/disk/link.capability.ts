import { defineCapability } from '../chain/capability.js';
import type { ChainSignature } from '../chain/capability.js';
import { refusal } from '../chain/refusals/refusal.js';
import type { LinkPort } from './link.port.js';
import { isDiskDirectory, isDiskFile } from './spec-path.js';
import type { DiskDirectory } from './spec-path.js';

export type LinkMethod<Self> = (name: string, source?: DiskDirectory) => Self;

export type LinkChain<Self> = {
    /** Link a package into the working directory's `node_modules`: the one a `directory()` holds, else the one the spec's own project resolves. */
    link: LinkMethod<Self>;
};

export interface LinkSignature extends ChainSignature {
    readonly chain: LinkChain<this['self']>;
}

type Linked = { readonly name: string; readonly path: null | string };

const PACKAGE_NAME = /^(?:@[a-z0-9~-][\w.~-]*\/)?[a-z0-9~-][\w.~-]*$/u;

function requirePackageName(name: unknown, linked: readonly Linked[]): string {
    if (typeof name !== 'string' || !PACKAGE_NAME.test(name) || name.toLowerCase() !== name) {
        throw new TypeError(
            refusal({
                fix: "name it as a package.json `dependencies` key does: link('@scope/name') or link('name')",
                found: `link(${JSON.stringify(name)}), no package name`,
                read: 'docs/guides/cli-specs.md#link--a-package-the-working-directory-resolves',
                why: 'The name is where the package lands, `node_modules/<name>`, and what the binary imports it by.',
            }),
        );
    }
    if (linked.some((entry) => entry.name === name)) {
        throw new TypeError(
            refusal({
                fix: `link ${name} once, from the one source the binary should resolve`,
                found: `link(${JSON.stringify(name)}), stated twice on one chain`,
                read: 'docs/guides/cli-specs.md#link--a-package-the-working-directory-resolves',
                why: 'A name resolves to one package: a second link of it would silently replace the first.',
            }),
        );
    }
    return name;
}

function requireSource(name: string, source: unknown): null | string {
    if (source === undefined) {
        return null;
    }
    if (isDiskDirectory(source)) {
        return source.path;
    }
    throw new TypeError(
        refusal('disk-named-by-relative-path-at-runtime', {
            fix: `name the package's directory: link('${name}', directory('./__fixtures__/${name.split('/').at(-1)}/'))`,
            found: isDiskFile(source)
                ? `link('${name}', file(${JSON.stringify(source.path)})), a file where a package's directory is read`
                : `link('${name}', ${typeof source === 'string' ? JSON.stringify(source) : typeof source}), a value where a package's directory is read`,
        }),
    );
}

export const link = defineCapability<
    'link',
    readonly Linked[],
    [name: string, source?: DiskDirectory],
    LinkSignature,
    { links: LinkPort }
>({
    arm: (linked, { links }, { testDir, workDir }) => {
        if (workDir !== null) {
            for (const { name, path } of linked) {
                links.link(name, path, testDir, workDir);
            }
        }
        return {};
    },
    initial: [],
    name: 'link',
    phase: 25,
    reduce: (linked, [name, source]) => {
        const checked = requirePackageName(name, linked);
        return [...linked, { name: checked, path: requireSource(checked, source) }];
    },
    row: { group: 'Setup', name: '.link()', probe: '.link(' },
});
