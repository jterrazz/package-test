import { existsSync, mkdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { refusal } from '../../../lint/index.refusal.js';
import type { LinkPort } from './link.port.js';
import { resolveSpecPath } from './resolved-spec-path.js';

export function installedPackage(name: string, testDir: string): null | string {
    let dir = testDir;
    for (;;) {
        const candidate = resolve(dir, 'node_modules', name);
        if (existsSync(candidate) && statSync(candidate).isDirectory()) {
            return candidate;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return null;
        }
        dir = parent;
    }
}

function sourceOf(name: string, path: null | string, testDir: string): string {
    if (path === null) {
        const installed = installedPackage(name, testDir);
        if (installed === null) {
            throw new Error(
                refusal({
                    fix: `install ${name} in the project the spec belongs to, or name the package's directory: link('${name}', directory('./_fixtures/…/'))`,
                    found: `link('${name}'): no node_modules from ${testDir} up holds ${name}`,
                    read: 'docs/12-cli.md#link--a-package-the-working-directory-resolves',
                    why: 'A bare name links the package the spec’s own project resolves, found as Node finds it.',
                }),
            );
        }
        return installed;
    }
    const src = resolveSpecPath('link', path, testDir);
    if (!existsSync(src)) {
        throw new Error(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `create ${src}, or correct the path`,
                found: `link('${name}', directory(${JSON.stringify(path)})) names nothing — ${src} does not exist`,
            }),
        );
    }
    if (!statSync(src).isDirectory()) {
        throw new TypeError(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `name the directory that holds the package's package.json: directory('${dirname(path)}/')`,
                found: `link('${name}', directory(${JSON.stringify(path)})) names a file`,
            }),
        );
    }
    return src;
}

export const fsLinks: LinkPort = {
    link: (name, path, testDir, workDir) => {
        const src = sourceOf(name, path, testDir);
        const dest = resolve(workDir, 'node_modules', name);
        mkdirSync(dirname(dest), { recursive: true });
        rmSync(dest, { force: true, recursive: true });
        symlinkSync(src, dest, 'dir');
    },
};
