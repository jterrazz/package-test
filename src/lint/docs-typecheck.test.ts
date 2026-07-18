import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

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
const ROOT = resolve(import.meta.dirname, '../..');
const DOCS = resolve(ROOT, 'docs');
const README = resolve(ROOT, 'README.md');
const CHANGELOG = resolve(ROOT, 'CHANGELOG.md');
const INDEX_MODULE = resolve(ROOT, 'src/index.js');
const TSC_BIN = resolve(ROOT, 'node_modules/typescript/bin/tsc');
const CACHE = resolve(ROOT, 'node_modules/.cache');

/**
 * The body of the newest (top) CHANGELOG release section — the entry documenting
 * the current major's surface. Sliced from its `## [x.y.z]` heading to the next
 * `## [` so historical entries (which describe long-gone APIs) are not checked.
 */
function latestChangelogSection(): string {
    const markdown = readFileSync(CHANGELOG, 'utf8');
    const headings = [...markdown.matchAll(/^## \[[^\]]+\][^\n]*$/gm)];
    // Skip an `## [Unreleased]` placeholder to reach the first real release.
    const start = headings.find((match) => !/\[unreleased\]/i.test(match[0]));
    if (start?.index === undefined) {
        return '';
    }
    const next = headings.find((match) => (match.index ?? 0) > (start.index ?? 0));
    return markdown.slice(start.index, next?.index ?? markdown.length);
}

/**
 * Every framework code block published to a consumer: the `docs/` reference, the
 * README headline samples, and the current CHANGELOG release notes. All three
 * are surfaces a stale sample would ship through, so all three are guarded.
 */
function frameworkBlocks(): string[] {
    const markdowns: string[] = [readFileSync(README, 'utf8'), latestChangelogSection()];
    for (const file of readdirSync(DOCS)) {
        if (file.endsWith('.md')) {
            markdowns.push(readFileSync(resolve(DOCS, file), 'utf8'));
        }
    }
    return markdowns.flatMap((markdown) =>
        extractTypescriptBlocks(markdown).filter(isFrameworkBlock),
    );
}

describe('docs-typecheck — block selection', () => {
    test('keeps a framework block, drops an app-code block', () => {
        // Given - one block importing only the framework, one importing app code
        const framework = "import { specification } from '@jterrazz/test';\n";
        const appCode = "import { createApp } from '../../src/app.js';\n";

        // Then - only the framework block is selected
        expect(isFrameworkBlock(framework)).toBe(true);
        expect(isFrameworkBlock(appCode)).toBe(false);
    });

    test('rewrites the framework specifier to the repo entry', () => {
        // Given - a framework import
        const rewritten = rewriteFrameworkImports(
            "import { specification } from '@jterrazz/test';",
            '/abs/src/index.js',
        );

        // Then - it points at the concrete module
        expect(rewritten).toContain("'/abs/src/index.js'");
        expect(rewritten).not.toContain('@jterrazz/test');
    });
});

describe('docs-typecheck — the published samples typecheck', () => {
    test('every framework code block in docs/ compiles against src/', () => {
        // Given - the framework-only ```typescript blocks across docs/
        const blocks = frameworkBlocks();
        expect(blocks.length).toBeGreaterThan(0);

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

    test('a framework block that drifts from the API is rejected', () => {
        // Given - a framework block with a type error (the drift this guard exists to catch)
        const drifted =
            "import { specification } from '@jterrazz/test';\nconst count: number = 'not a number';\nvoid specification;\nvoid count;\n";

        // Then - the checker bites: it fails with a real diagnostic (proves the
        // Green run above is a genuine typecheck, not a vacuous pass)
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
});

// Sanity: the harness paths the test depends on exist (guards silent skips).
describe('docs-typecheck — harness', () => {
    test('the tsc binary and docs directory are present', () => {
        // Given - the repo layout
        // Then - the meta-test can actually run over every published surface
        expect(existsSync(TSC_BIN)).toBe(true);
        expect(existsSync(DOCS)).toBe(true);
        expect(existsSync(README)).toBe(true);
        expect(existsSync(CHANGELOG)).toBe(true);
        expect(latestChangelogSection()).not.toBe('');
    });
});
