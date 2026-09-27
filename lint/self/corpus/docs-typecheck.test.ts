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

const ROOT = resolve(import.meta.dirname, '../../..');
const DOCS = resolve(ROOT, 'docs');
const README = resolve(ROOT, 'README.md');
const SKILL = resolve(ROOT, 'skills/jterrazz-test/SKILL.md');
const INDEX_MODULE = resolve(ROOT, 'src/index.js');
const TSC_BIN = resolve(ROOT, 'node_modules/typescript/bin/tsc');
const CACHE = resolve(ROOT, 'node_modules/.cache');

/** The skill ships samples too, so it is guarded with the chapters and the README. */
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

/** Awaiting a non-promise is legal for `tsc`, but the toolchain's `await-thenable` refuses it in every consumer. A component's accessors are absent: their capture crosses the browser seam. */
const SYNC_SUBJECTS = ['error', 'json', 'response', 'stderr', 'stdout', 'value'];
describe('docs-typecheck', () => {
    test('docs-typecheck — block selection — keeps a framework block, drops an app-code block', () => {
        // Given - one block importing only the framework, one importing app code
        const framework = { code: "import { specification } from '@jterrazz/test';\n", jsx: false };
        const appCode = { code: "import { createApp } from '../src/app.js';\n", jsx: false };

        // Then - only the framework block is selected
        expect(isFrameworkBlock(framework)).toBe(true);
        expect(isFrameworkBlock(appCode)).toBe(false);
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
        // are all JSX must not be the one this guard silently skips
        expect(blocks.some((block) => block.jsx)).toBe(true);
        // And - so are the mobile samples: the facet no CI provisions is the
        // one whose samples nothing else would ever compile
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
        expect(result.ok).toBe(true);
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
        expect(result.ok).toBe(false);
        expect(result.output).not.toBe('');
    }, 60_000);

    /** `toBeEmpty()` is a table's matcher, and a table's is async. */

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

    test('docs-typecheck — harness — the tsc binary and docs directory are present', () => {
        // Given - the repo layout
        // Then - the meta-test can actually run over every published surface
        expect(existsSync(TSC_BIN)).toBe(true);
        expect(existsSync(DOCS)).toBe(true);
        expect(existsSync(README)).toBe(true);
    });
});
