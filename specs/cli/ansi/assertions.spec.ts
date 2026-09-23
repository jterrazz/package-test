import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { file } from '../../../src/index.js';
import { cli as asymmetricCli } from '../asymmetric-transform-cli.specification.js';
import { cli as transformCli } from '../transform-cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, 'expected');

/** Run a block with TEST_UPDATE=1 so toMatch writes the fixture. */
function inUpdateMode(block: () => void): void {
    vi.stubEnv('TEST_UPDATE', '1');
    try {
        block();
    } finally {
        vi.unstubAllEnvs();
    }
}

/*
 * This file is the framework's own matcher/accessor self-test: the toContain probes
 * demonstrate the .text/.raw/.file accessors and matcher behaviour themselves —
 * the fixture CLI's output is the vehicle, not the assertion target. Whole-output
 * correctness is exercised by the toMatch(file(…)) golden cases throughout.
 */
/* oxlint-disable jterrazz/d8w-raw-bypass -- The raw `.raw` accessor IS the subject
   under test here (see the note above): every `.raw` assertion proves what the
   comparison strips. Whole-output goldens are the toMatch(file(…)) cases in this file. */

describe('assertions', () => {
    test('transform strips ANSI from stdout before toMatch comparison', async () => {
        // Given - a runner with an ANSI-stripping transform and a clean fixture
        const fixtureName = `transform-clean-${Date.now()}.txt`;
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(resolve(EXPECTED_DIR, fixtureName), 'red plain bold\n');

            const result = await transformCli.exec('ansi');

            // Then - .raw still contains the original ANSI escapes
            expect(result.stdout.raw).toContain('\u001B[31m');
            expect(result.stdout.raw).toContain('\u001B[0m');

            // Then - comparison passes because the transform stripped ANSI from the actual
            expect(result.stdout).toMatch(file(`./expected/${fixtureName}`));
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true });
        }
    });

    test('transform does NOT mutate result.stdout.raw, and .text is its output', async () => {
        // Given - a runner with an ANSI-stripping transform
        const result = await transformCli.exec('ansi');

        // Then - pristine output preserved, and the value a reader compares is the transformed one
        expect(result.stdout.raw).toBe('\u001B[31mred\u001B[0m plain \u001B[1mbold\u001B[0m\n');
        expect(result.stdout.text).toBe('red plain bold\n');
    });

    test('.text applies a transform that is not the default one, after the ANSI strip', async () => {
        // Given - a runner whose transform drops the word " plain", and a coloured line
        const result = await asymmetricCli.exec('ansi');

        // Then - the capture is untouched, and the text a reader compares is stripped then transformed
        expect(result.stdout.raw).toBe('\u001B[31mred\u001B[0m plain \u001B[1mbold\u001B[0m\n');
        expect(result.stdout.text).toBe('red bold\n');
    });

    test('toString and valueOf give the comparable text, not the capture', async () => {
        // Given - the same run: ANSI in the capture, and a transform
        const result = await asymmetricCli.exec('ansi');

        // Then - every coercion reads what .text reads
        expect(String(result.stdout)).toBe('red bold\n');
        expect(result.stdout.toString()).toBe('red bold\n');
        expect(result.stdout.valueOf()).toBe('red bold\n');
    });

    test('.grep() cuts the capture before the transform, and what it keeps reads through it', async () => {
        // Given - a pattern the transform removes from the text, but the capture holds
        const result = await asymmetricCli.exec('ansi');
        const kept = result.stdout.grep('plain');

        // Then - the block is cut from the colour-free capture, before the transform, and its text reads through the transform like the stream's
        expect(kept.raw).toBe('red plain bold\n');
        expect(kept.text).toBe('red bold\n');
        expect(result.stdout.grep('absent').text).toBe('');
    });

    test('transform only runs on actual, never on fixture', async () => {
        // Given - a transform that strips the word " plain" (ANSI is already stripped by default), and a fixture matching the transformed form
        const fixtureName = `transform-asymmetric-${Date.now()}.txt`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            // Fixture lacks " plain" — matches what the transform produces from actual.
            writeFileSync(fixturePath, 'red bold\n');

            const result = await asymmetricCli.exec('ansi');

            // Then - passes only because the fixture is authoritative — NOT transformed
            expect(result.stdout).toMatch(file(`./expected/${fixtureName}`));
            expect(readFileSync(fixturePath, 'utf8')).not.toContain(' plain');
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });

    test('transform writes the post-normalisation form when updating', async () => {
        // Given - update mode with an ANSI-stripping transform
        const fixtureName = `transform-update-${Date.now()}.txt`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            const result = await transformCli.exec('ansi');
            inUpdateMode(() => {
                expect(result.stdout).toMatch(file(`./expected/${fixtureName}`));
            });

            // Then - no ANSI in the fixture — transform ran before write
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toBe('red plain bold\n');
            expect(written).not.toContain('\u001B[');
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });
});
