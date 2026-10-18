import { mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { refusal } from '../chain/refusals/refusal.js';
import { installedPackage } from './installed-package.js';
import { linkedDirectory, refuseUnusableAncestor } from './link-destination.js';
import type { LinkPort } from './link.port.js';
import { installPacked } from './npm-packed.adapter.js';

function sourceOf(name: string, path: null | string, testDir: string): string {
    if (path === null) {
        const installed = installedPackage(name, testDir);
        if (installed === null) {
            throw new Error(
                refusal({
                    fix: `install ${name} in the project the spec belongs to, or name the package's directory: link('${name}', directory('./__fixtures__/<package>/'))`,
                    found: `link('${name}'): no node_modules from ${testDir} up holds ${name}`,
                    read: 'docs/guides/cli-specs.md#link-a-package-the-working-directory-resolves',
                    why: "A bare name links the package the spec's own project resolves, found as Node finds it.",
                }),
            );
        }
        return installed;
    }
    return linkedDirectory(`link('${name}', directory(${JSON.stringify(path)}))`, path, testDir);
}

export const fsLinks: LinkPort = {
    packed: installPacked,
    link: (name, path, testDir, workDir) => {
        const src = sourceOf(name, path, testDir);
        const dest = resolve(workDir, 'node_modules', name);
        refuseUnusableAncestor(name, workDir, dest);
        mkdirSync(dirname(dest), { recursive: true });
        rmSync(dest, { force: true, recursive: true });
        symlinkSync(src, dest, 'dir');
    },
};
