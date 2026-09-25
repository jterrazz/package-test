import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { DocBlock } from './docs-typecheck.js';
import {
    extractTypescriptBlocks,
    isFrameworkBlock,
    rewriteFrameworkImports,
    typecheckDocBlocks,
} from './docs-typecheck.js';

/**
 * Meta-test — the published docs must typecheck against the real framework
 * surface. Catches the historical defect class of a sample drifting from the
 * API (a removed `.spawn()`, a renamed accessor). See docs-typecheck.ts for the
 * precision-over-coverage block selection.
 */
const ROOT = resolve(import.meta.dirname, '..');
const DOCS = resolve(ROOT, 'docs');
const README = resolve(ROOT, 'README.md');
const SKILL = resolve(ROOT, 'skills/jterrazz-test/SKILL.md');
const INDEX_MODULE = resolve(ROOT, 'src/index.js');
const TSC_BIN = resolve(ROOT, 'node_modules/typescript/bin/tsc');
const CACHE = resolve(ROOT, 'node_modules/.cache');

/**
 * Every framework code block published to a reader: the `docs/` chapters, the
 * README headline samples, and the skill an agent reads before writing a test.
 * All three are surfaces a stale sample would ship through, so all three are
 * guarded.
 */
function frameworkBlocks(): DocBlock[] {
    const markdowns: string[] = [readFileSync(README, 'utf8'), readFileSync(SKILL, 'utf8')];
    for (const file of readdirSync(DOCS)) {
        if (file.endsWith('.md')) {
            markdowns.push(readFileSync(resolve(DOCS, file), 'utf8'));
        }
    }
    return markdowns.flatMap((markdown) =>
        extractTypescriptBlocks(markdown).filter(isFrameworkBlock),
    );
}

/**
 * The result accessors the compiler types as SYNCHRONOUS, whatever facet they
 * came from. `tsc` alone does not catch an `await` on one — awaiting a
 * non-promise is legal TypeScript — but the toolchain's `await-thenable` pass
 * refuses it in every consumer, so a chapter that prescribes the awaited form
 * hands the reader a file their own gate rejects.
 *
 * A component's accessors are deliberately absent: their capture crosses the
 * browser seam, so `await` is right there and chapter 14 says so.
 */
const SYNC_SUBJECTS = ['error', 'json', 'response', 'stderr', 'stdout', 'value'];
describe('docs-typecheck', () => {
    test('docs-typecheck — block selection — keeps a framework block, drops an app-code block', () => {
        // Given - one block importing only the framework, one importing app code
        const framework = { code: "import { specification } from '@jterrazz/test';\n", jsx: false };
        const appCode = { code: "import { createApp } from '../src/app.js';\n", jsx: false };

        // Then - only the framework block is selected
        expect(isFrameworkBlock(framework)).toBeTruthy();
        expect(isFrameworkBlock(appCode)).toBeFalsy();
    });

    test('docs-typecheck — block selection — rewrites the framework specifier to the repo entry', () => {
        // Given - a framework import
        const rewritten = rewriteFrameworkImports(
            "import { specification } from '@jterrazz/test';",
            '/abs/src/index.js',
        );

        // Then - it points at the concrete module
        expect(rewritten).toContain("'/abs/src/index.js'");
        expect(rewritten).not.toContain('@jterrazz/test');
    });

    test('docs-typecheck — the published samples typecheck — every framework code block in docs/ compiles against src/', () => {
        // Given - the framework-only ```typescript and ```tsx blocks across docs/
        const blocks = frameworkBlocks();
        expect(blocks.length).toBeGreaterThan(0);
        // And - the rendered examples are among them: a chapter whose examples
        // Are all JSX must not be the one this guard silently skips
        expect(blocks.some((block) => block.jsx)).toBeTruthy();
        // And - so are the mobile samples: the facet no CI provisions is the
        // One whose samples nothing else would ever compile
        expect(blocks.some((block) => block.code.includes('specification.mobile'))).toBe(true);

        // Then - tsc --noEmit accepts them all (no drift from the real API)
        mkdirSync(CACHE, { recursive: true });
        const result = typecheckDocBlocks({
            blocks,
            cacheDir: CACHE,
            indexModule: INDEX_MODULE,
            tscBin: TSC_BIN,
        });
        expect(result.output).toBe('');
        expect(result.ok).toBeTruthy();
    }, 60_000);

    test('docs-typecheck — the published samples typecheck — a framework block that drifts from the API is rejected', () => {
        // Given - a framework block with a type error (the drift this guard exists to catch)
        const drifted: DocBlock = {
            code: "import { specification } from '@jterrazz/test';\nconst count: number = 'not a number';\nvoid specification;\nvoid count;\n",
            jsx: false,
        };

        // Then - the checker bites: it fails with a real diagnostic (proves the green run above is a genuine typecheck, not a vacuous pass)
        mkdirSync(CACHE, { recursive: true });
        const result = typecheckDocBlocks({
            blocks: [drifted],
            cacheDir: CACHE,
            indexModule: INDEX_MODULE,
            tscBin: TSC_BIN,
        });
        expect(result.ok).toBeFalsy();
        expect(result.output).not.toBe('');
    }, 60_000);

    /** `toBeEmpty()` is not in the sweep: it is a table's matcher, and a table's is async. */

    test('docs-typecheck — the corpus does not await a sync matcher — no page writes `await expect(result.<sync>).toMatch(file(`', () => {
        // Given - every page a consumer is routed to
        const pages = [
            { name: 'README.md', text: readFileSync(README, 'utf8') },
            { name: 'SKILL.md', text: readFileSync(SKILL, 'utf8') },
            ...readdirSync(DOCS)
                .filter((file) => file.endsWith('.md'))
                .map((file) => ({ name: file, text: readFileSync(resolve(DOCS, file), 'utf8') })),
        ];

        // Then - none of them awaits a matcher the compiler types as sync
        const offenders = pages.flatMap(({ name, text }) =>
            SYNC_SUBJECTS.filter((subject) =>
                text.includes(`await expect(result.${subject}).toMatch(file(`),
            ).map((subject) => `${name}: await expect(result.${subject}).toMatch(file(`),
        );
        expect(offenders, 'the toolchain refuses this as await-thenable').toStrictEqual([]);
    });

    // Sanity: the harness paths the test depends on exist (guards silent skips).
    test('docs-typecheck — harness — the tsc binary and docs directory are present', () => {
        // Given - the repo layout
        // Then - the meta-test can actually run over every published surface
        expect(existsSync(TSC_BIN)).toBeTruthy();
        expect(existsSync(DOCS)).toBeTruthy();
        expect(existsSync(README)).toBeTruthy();
    });
});
