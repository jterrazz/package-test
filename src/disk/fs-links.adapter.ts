import { existsSync, lstatSync, mkdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { refusal } from '../../lint/refusal.js';
import { resolveSpecPath } from '../chain/paths/resolved-spec-path.js';
import type { LinkPort } from './link.port.js';

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
        throw new Error(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `name the directory that holds the package's package.json: directory('${dirname(path)}/')`,
                found: `link('${name}', directory(${JSON.stringify(path)})) names a file`,
            }),
        );
    }
    return src;
}

function refuseUnusableAncestor(name: string, workDir: string, dest: string): void {
    let ancestor = workDir;
    for (const segment of relative(workDir, dirname(dest)).split(/[\\/]/u)) {
        ancestor = resolve(ancestor, segment);
        if (!existsSync(ancestor)) {
            return;
        }
        const entry = lstatSync(ancestor);
        if (!entry.isSymbolicLink() && !entry.isDirectory()) {
            throw new Error(
                refusal({
                    fix: `drop the file at ${ancestor} from the fixture or the command that lays it, so the link can lay its folder there`,
                    found: `link('${name}'): ${ancestor} is a file, not a folder`,
                    read: 'docs/12-cli.md#link--a-package-the-working-directory-resolves',
                    why: 'A link is laid at node_modules/<name> inside the working directory, and a file on that path leaves it no folder to lay it in.',
                }),
            );
        }
        if (entry.isSymbolicLink()) {
            throw new Error(
                refusal({
                    fix: `drop the symlink at ${ancestor} from the fixture or the command that lays it, so the working directory holds its own node_modules`,
                    found: `link('${name}'): ${ancestor} is a symlink, so the link would replace ${name} wherever it points`,
                    read: 'docs/12-cli.md#link--a-package-the-working-directory-resolves',
                    why: 'A link is laid inside the working directory only; through a symlinked folder it would delete a real install outside it.',
                }),
            );
        }
    }
}

export const fsLinks: LinkPort = {
    link: (name, path, testDir, workDir) => {
        const src = sourceOf(name, path, testDir);
        const dest = resolve(workDir, 'node_modules', name);
        refuseUnusableAncestor(name, workDir, dest);
        mkdirSync(dirname(dest), { recursive: true });
        rmSync(dest, { force: true, recursive: true });
        symlinkSync(src, dest, 'dir');
    },
};
