import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** What a rule reads of a path starts at the package root, so the folder above must answer for nothing. */
export function checkoutUnder(folder: string, folders: string[] = []): string {
    const scratch = mkdtempSync(join(tmpdir(), 'checkout-'));
    const root = join(scratch, folder, 'checkout');
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'package.json'), '{}\n');
    for (const inside of folders) {
        mkdirSync(join(root, inside), { recursive: true });
    }
    return root;
}

export function repositoryUnder(
    folder: string,
    folders: string[] = [],
    git: 'directory' | 'file' = 'directory',
): string {
    const scratch = mkdtempSync(join(tmpdir(), 'repository-'));
    const root = join(scratch, folder, 'repository');
    mkdirSync(root, { recursive: true });
    for (const inside of folders) {
        mkdirSync(join(root, inside), { recursive: true });
    }
    if (git === 'directory') {
        mkdirSync(join(root, '.git'));
    } else {
        writeFileSync(join(root, '.git'), 'gitdir: /elsewhere/.git/worktrees/repository\n');
    }
    return root;
}

export function packageWith(files: Record<string, string>): string {
    const root = checkoutUnder('work');
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    return root;
}
