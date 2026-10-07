import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { OWN_FIXES_WRAPPER } from '../own-fixes.js';

export const off = {
    correctness: 'off',
    nursery: 'off',
    pedantic: 'off',
    perf: 'off',
    restriction: 'off',
    style: 'off',
    suspicious: 'off',
};

export const disarmed = { reportUnusedDisableDirectives: 'off', typeAware: false };

export function projectWith(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'own-fixes-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

export function stubOxlint(root: string, status: number, script = ''): void {
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    const bin = join(root, 'node_modules', '.bin', 'oxlint');
    writeFileSync(
        bin,
        `#!/bin/sh\necho "$@" >> "${root}/args.txt"\npwd -P >> "${root}/cwds.txt"\ncp ${OWN_FIXES_WRAPPER} wrapper.mjs\necho "cannot run" >&2\n${script}\nexit ${status}\n`,
    );
    chmodSync(bin, 0o755);
}
