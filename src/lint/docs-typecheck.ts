import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Doc typechecking — the guard against the historical defect class where a
 * `docs/*.md` sample drifts from the real API (e.g. keeps calling a removed
 * `.spawn()`). It extracts the ```typescript blocks that import the framework,
 * rewrites `@jterrazz/test` to the repo source, and runs the real `tsc` over
 * them so a stale sample surfaces as a type error.
 *
 * **Precision over coverage** (the miner's guidance): only blocks whose imports
 * are the framework plus resolvable neighbours (vitest, node builtins) are
 * checked. A block importing app code (`createApp`, `../../src/app.js`) is a
 * prose illustration of the *consumer's* code, not the framework surface, and
 * is skipped — it cannot resolve and would only add noise.
 */

/** Import specifiers allowed alongside `@jterrazz/test` in a checkable block. */
const ALLOWED_NEIGHBOURS = new Set(['vitest', 'vitest/config']);

const FRAMEWORK_SPECIFIER = '@jterrazz/test';
const TYPESCRIPT_BLOCK = /```typescript\n(?<code>[\s\S]*?)```/g;
const IMPORT_SOURCE = /(?:import|export)[^\n]*?\bfrom\s+['"](?<source>[^'"]+)['"]/g;
/** Vitest globals a runnable example must import to resolve. */
const TEST_GLOBAL = /\b(?:expect|describe|test|it|beforeAll|afterAll|beforeEach|afterEach)\s*\(/;

/** Every ```typescript fenced block in a markdown document. */
export function extractTypescriptBlocks(markdown: string): string[] {
    return [...markdown.matchAll(TYPESCRIPT_BLOCK)].map((match) => match.groups?.code ?? '');
}

/** The import specifiers of a code block. */
function importSources(code: string): string[] {
    return [...code.matchAll(IMPORT_SOURCE)].map((match) => match.groups?.source ?? '');
}

/**
 * A block worth typechecking: it imports the framework entry, and every other
 * import resolves without app context (vitest, node builtins). App-code samples
 * are skipped on purpose.
 */
export function isFrameworkBlock(code: string): boolean {
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
    // A fragment leaning on ambient vitest globals it never imports is prose,
    // Not a runnable example — checking it would only raise phantom TS2304s.
    const selfContained = !TEST_GLOBAL.test(code) || sources.includes('vitest');
    return importsResolve && selfContained;
}

/** Rewrite the framework import to a concrete module (the repo source entry). */
export function rewriteFrameworkImports(code: string, indexModule: string): string {
    return code.replaceAll(`'${FRAMEWORK_SPECIFIER}'`, `'${indexModule}'`);
}

export type DocTypecheckResult = { blocks: number; ok: boolean; output: string };

/**
 * Extract every framework block from the docs, rewrite its import to
 * `indexModule` (an absolute path to `src/index.js`, resolved to `.ts` by the
 * Bundler module resolution), and run `tsc --noEmit` over them in a scratch
 * project. The scratch dir lives under `cacheDir` (a path inside the repo so
 * `vitest`/`node` type resolution walks up to the repo `node_modules`).
 */
export function typecheckDocBlocks(options: {
    blocks: string[];
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
        blocks.forEach((block, index) => {
            writeFileSync(
                join(dir, `block-${index}.ts`),
                rewriteFrameworkImports(block, indexModule),
            );
        });
        writeFileSync(
            join(dir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    esModuleInterop: true,
                    module: 'ESNext',
                    moduleResolution: 'Bundler',
                    noEmit: true,
                    resolveJsonModule: true,
                    skipLibCheck: true,
                    strict: true,
                    target: 'ESNext',
                    types: ['node'],
                },
                include: ['block-*.ts'],
            }),
        );
        try {
            execFileSync(process.execPath, [tscBin, '--project', dir], {
                encoding: 'utf8',
                stdio: 'pipe',
            });
            return { blocks: blocks.length, ok: true, output: '' };
        } catch (error) {
            const shell = error as { stderr?: string; stdout?: string };
            return {
                blocks: blocks.length,
                ok: false,
                output: `${shell.stdout ?? ''}${shell.stderr ?? ''}`.trim(),
            };
        }
    } finally {
        rmSync(dir, { force: true, recursive: true });
    }
}
