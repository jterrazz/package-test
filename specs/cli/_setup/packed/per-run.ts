import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestProject } from 'vitest/node';

const CHECKOUT = resolve(import.meta.dirname, '../../../..');

/** Packs the checkout once per run (`npm run build` first) and unpacks the tarball as an install lays it; its dependencies resolve from the checkout's own install, beside it. */
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
    symlinkSync(join(CHECKOUT, 'node_modules'), join(into, 'node_modules'), 'dir');
    project.provide('packedPackage', join(into, 'package'));
    return () => {
        rmSync(into, { force: true, recursive: true });
    };
}
