import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Only blocks importing the framework plus resolvable neighbours are checked: a block importing app code illustrates the consumer's code and cannot resolve. */

const ALLOWED_NEIGHBOURS = new Set(['react', 'vitest', 'vitest/config']);

const FRAMEWORK_SPECIFIER = '@jterrazz/test';
const TYPESCRIPT_BLOCK = /```(?<language>typescript|tsx)\n(?<code>[\s\S]*?)```/gu;
const IMPORT_SOURCE = /(?:import|export)[^\n]*?\bfrom\s+['"](?<source>[^'"]+)['"]/gu;
const TEST_GLOBAL = /\b(?:expect|describe|test|it|beforeAll|afterAll|beforeEach|afterEach)\s*\(/u;

export type DocBlock = { code: string; jsx: boolean };

export function extractTypescriptBlocks(markdown: string): DocBlock[] {
    return [...markdown.matchAll(TYPESCRIPT_BLOCK)].map((match) => ({
        code: match.groups?.code ?? '',
        jsx: match.groups?.language === 'tsx',
    }));
}

function importSources(code: string): string[] {
    return [...code.matchAll(IMPORT_SOURCE)].map((match) => match.groups?.source ?? '');
}

export function isFrameworkBlock(block: DocBlock): boolean {
    const { code } = block;
    const sources = importSources(code);
    if (!sources.includes(FRAMEWORK_SPECIFIER)) {
        return false;
    }
    const importsResolve = sources.every(
        (source) =>
            source === FRAMEWORK_SPECIFIER ||
            source.startsWith('node:') ||
            ALLOWED_NEIGHBOURS.has(source),
    );
    // outside: a fragment leaning on vitest globals it never imports is prose: checking it would only raise phantom TS2304s.
    const selfContained = !TEST_GLOBAL.test(code) || sources.includes('vitest');
    return importsResolve && selfContained;
}

export function rewriteFrameworkImports(code: string, indexModule: string): string {
    return code.replaceAll(`'${FRAMEWORK_SPECIFIER}'`, `'${indexModule}'`);
}

export type DocTypecheckResult = { blocks: number; ok: boolean; output: string };

/** The scratch project lives under `cacheDir`, inside the repository, so type resolution walks up to its `node_modules`. */
export function typecheckDocBlocks(options: {
    blocks: DocBlock[];
    cacheDir: string;
    indexModule: string;
    tscBin: string;
}): DocTypecheckResult {
    const { blocks, cacheDir, indexModule, tscBin } = options;
    if (blocks.length === 0) {
        return { blocks: 0, ok: true, output: '' };
    }
    const dir = mkdtempSync(join(cacheDir, 'docs-typecheck-'));
    try {
        for (const [index, block] of blocks.entries()) {
            writeFileSync(
                join(dir, `block-${index}.${block.jsx ? 'tsx' : 'ts'}`),
                rewriteFrameworkImports(block.code, indexModule),
            );
        }
        writeFileSync(
            join(dir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    esModuleInterop: true,
                    jsx: 'react-jsx',
                    module: 'ESNext',
                    moduleResolution: 'Bundler',
                    noEmit: true,
                    resolveJsonModule: true,
                    skipLibCheck: true,
                    strict: true,
                    target: 'ESNext',
                    types: ['node'],
                },
                include: ['block-*.ts', 'block-*.tsx'],
            }),
        );
        try {
            execFileSync(process.execPath, [tscBin, '--project', dir], {
                encoding: 'utf8',
                stdio: 'pipe',
            });
            return { blocks: blocks.length, ok: true, output: '' };
        } catch (error) {
            const streamOf = (key: 'stderr' | 'stdout'): string =>
                typeof error === 'object' && error !== null && key in error
                    ? String(Reflect.get(error, key) ?? '')
                    : '';
            return {
                blocks: blocks.length,
                ok: false,
                output: `${streamOf('stdout')}${streamOf('stderr')}`.trim(),
            };
        }
    } finally {
        rmSync(dir, { force: true, recursive: true });
    }
}
