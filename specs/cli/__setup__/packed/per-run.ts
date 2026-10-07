import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

import { CHECKOUT, packedFilenames } from './closure.ts';

export default function setup(project: TestProject): () => void {
    const into = mkdtempSync(join(tmpdir(), 'packed-'));
    const report = execFileSync(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--pack-destination', into],
        { cwd: CHECKOUT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    for (const filename of packedFilenames(report)) {
        execFileSync('tar', ['-xzf', join(into, filename), '-C', into]);
    }
    project.provide('packedPackage', join(into, 'package'));
    return () => {
        rmSync(into, { force: true, recursive: true });
    };
}
