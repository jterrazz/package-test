import { existsSync, lstatSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { refusal } from '../chain/refusals/refusal.js';

/** Refuses a destination under the working directory whose path crosses a file or a symlink: through a symlinked folder, the delete before the lay would reach a real install outside it. */
export function refuseUnusableAncestor(name: string, workDir: string, dest: string): void {
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
                    read: 'docs/guides/cli-specs.md#link--a-package-the-working-directory-resolves',
                    why: 'A link is laid at node_modules/<name> inside the working directory, and a file on that path leaves it no folder to lay it in.',
                }),
            );
        }
        if (entry.isSymbolicLink()) {
            throw new Error(
                refusal({
                    fix: `drop the symlink at ${ancestor} from the fixture or the command that lays it, so the working directory holds its own node_modules`,
                    found: `link('${name}'): ${ancestor} is a symlink, so the link would replace ${name} wherever it points`,
                    read: 'docs/guides/cli-specs.md#link--a-package-the-working-directory-resolves',
                    why: 'A link is laid inside the working directory only; through a symlinked folder it would delete a real install outside it.',
                }),
            );
        }
    }
}
