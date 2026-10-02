import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

import { CHECKOUT } from './closure.ts';

export default function setup(project: TestProject): () => void {
    const into = mkdtempSync(join(tmpdir(), 'packed-'));
    const report = execFileSync(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--pack-destination', into],
        { cwd: CHECKOUT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: npm prints one report per package, keyed by name, each with the `filename` this reads
    const packed = JSON.parse(report) as Record<string, { filename: string }>;
    for (const { filename } of Object.values(packed)) {
        execFileSync('tar', ['-xzf', join(into, filename), '-C', into]);
    }
    project.provide('packedPackage', join(into, 'package'));
    return () => {
        rmSync(into, { force: true, recursive: true });
    };
}
