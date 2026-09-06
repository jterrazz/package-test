import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { literate, literateModule } from './literate-plugin.js';

const SOURCE = [
    'test: refuses to guess outside the checkout',
    'given: an empty workdir',
    'then: the error names where to run',
    '',
    '$ repositories',
    'exit: 1',
    '',
].join('\n');

describe('literate() — the vite plugin door', () => {
    test('the header title becomes the test title and the file runs itself', () => {
        // Given - a literate source and the runner it is bound to
        const module = literateModule(SOURCE, '/specs/cli/no-estate.cli', '/specs/cli/x.spec.ts');

        // Then - one test, titled by `test:`, running the .cli path through cli.run
        expect(module).toContain('test("refuses to guess outside the checkout"');
        expect(module).toContain('import { cli } from "/specs/cli/x.spec.ts";');
        expect(module).toContain('await cli.run("/specs/cli/no-estate.cli");');
    });

    test('the plugin adds the .cli glob to the project test include', () => {
        // Given - a plugin with the default include
        const plugin = literate({ specification: './specs/cli/cli.specification.ts' });

        // Then - vitest is told to collect .cli files as test files
        expect(plugin.config()).toEqual({ test: { include: ['**/*.cli'] } });
        expect(plugin.enforce).toBe('pre');
    });

    test('a narrowed include is passed through untouched', () => {
        // Given - a tree where only one folder holds runnable scenarios
        const plugin = literate({
            include: ['specs/cli/literate/*.cli'],
            specification: './specs/cli/cli.specification.ts',
        });

        // Then
        expect(plugin.config()).toEqual({ test: { include: ['specs/cli/literate/*.cli'] } });
    });

    test('only .cli ids are loaded; the specification path resolves against the vite root', () => {
        // Given - a real .cli on disk and a resolved vite root
        const dir = mkdtempSync(resolve(tmpdir(), 'literate-plugin-'));
        const filePath = resolve(dir, 'case.cli');
        writeFileSync(filePath, SOURCE);
        const plugin = literate({ specification: './cli.specification.ts' });
        plugin.configResolved({ root: dir });

        // Then - a .ts id is none of the plugin's business, a .cli id becomes a module
        expect(plugin.load(resolve(dir, 'other.test.ts'))).toBeNull();
        expect(plugin.load(filePath)).toContain(
            `import { cli } from ${JSON.stringify(resolve(dir, 'cli.specification.ts'))};`,
        );
    });
});
