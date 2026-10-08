import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { refuseUnusableAncestor } from '../link-destination.js';

const refusalOf = (work: () => void): string => {
    try {
        work();
        return 'laid';
    } catch (error) {
        return error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
    }
};

const work = (): string => realpathSync(scratchDirectory('destination-'));

const check = (workDir: string): string =>
    refusalOf(() => {
        refuseUnusableAncestor('@acme/lib', workDir, join(workDir, 'node_modules/@acme/lib'));
    });

describe('link-destination', () => {
    test('link destination — refuseUnusableAncestor — the path to a link — passes through folders and what is not there yet, and stops at a file or a symlink', () => {
        // Given - working directories whose node_modules is a folder, absent, a file, and a symlink, and one whose scope folder is a symlink
        const [folder, absent, file, linked, scoped] = [work(), work(), work(), work(), work()];
        mkdirSync(join(folder, 'node_modules/@acme'), { recursive: true });
        writeFileSync(join(file, 'node_modules'), '');
        symlinkSync(absent, join(linked, 'node_modules'), 'dir');
        mkdirSync(join(scoped, 'node_modules'));
        symlinkSync(absent, join(scoped, 'node_modules/@acme'), 'dir');

        // Then - only the file and the symlinks on the way are refused, each named
        expect([folder, absent, file, linked, scoped].map(check)).toStrictEqual([
            'laid',
            'laid',
            `found: link('@acme/lib'): ${join(file, 'node_modules')} is a file, not a folder`,
            `found: link('@acme/lib'): ${join(linked, 'node_modules')} is a symlink, so the link would replace @acme/lib wherever it points`,
            `found: link('@acme/lib'): ${join(scoped, 'node_modules/@acme')} is a symlink, so the link would replace @acme/lib wherever it points`,
        ]);
    });
});
