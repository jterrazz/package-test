import { directory } from '@jterrazz/test';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('prepared', () => {
    test('a step runs over the tree the fixtures laid, and lays what no fixture can carry', async () => {
        // Given - a project fixture, made a repository whose index holds what the fixture laid
        const result = await cli
            .fixture(directory('./_fixtures/project/'))
            .prepare((workdir) => {
                execFileSync('git', ['init', '--quiet'], { cwd: workdir });
                execFileSync('git', ['add', '.'], { cwd: workdir });
            })
            .exec('tracked');

        // Then - the binary reads the repository the step made
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            app.ts
        `);
    });

    test('steps run in the order stated, and a file laid after the index is no part of it', async () => {
        // Given - a repository staged by one step, then a file a second step writes
        const result = await cli
            .fixture(directory('./_fixtures/project/'))
            .prepare((workdir) => {
                execFileSync('git', ['init', '--quiet'], { cwd: workdir });
                execFileSync('git', ['add', '.'], { cwd: workdir });
            })
            .prepare(async (workdir) => {
                await writeFile(join(workdir, 'added.ts'), 'export {};\n');
            })
            .exec('tracked');

        // Then - the index holds the fixture's file alone, and the later file is on disk beside it
        expect(result.stdout).toMatch(`
            app.ts
        `);
        expect(result.file('added.ts').exists).toBe(true);
    });
});
