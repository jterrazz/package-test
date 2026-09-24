import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, 'expected');

describe('tokens', () => {
    test('matches dynamic values via typed tokens including {{workdir}}', async () => {
        // Given - output mixing a semver, a uuid, a timestamp, the cwd, and a duration
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('version');

        // Then - the committed fixture matches through the token grammar
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/version.txt'));
    });

    test('{{workdir}} is the exact cwd of the spec — a different path fails', async () => {
        // Given - two runs, each with its own temp cwd
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('version');

        // Then - the fixture matched THIS run's cwd (fresh cwd per spec means A stale literal path could never pass — the token is exact)
        expect(result.stdout.text).toContain('cwd /');
        expect(result.stdout).toMatch(file('./expected/version.txt'));
    });

    test('update mode substitutes the workdir and preserves tokens (CONVENTIONS D5)', async () => {
        // Given - update mode on a fresh fixture name
        const fixtureName = `version-transient-${Date.now()}.txt`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            const result = await cli
                .fixture(directory('../../shared/fixtures/specimen-cli/'))
                .exec('version');
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                expect(result.stdout).toMatch(file(`./expected/${fixtureName}`));
            } finally {
                vi.unstubAllEnvs();
            }

            // Then - the written fixture contains the {{workdir}} token, not the raw path
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toContain('cwd {{workdir}}');
            expect(written).not.toMatch(/cwd \//u);

            // Then - a second run (different cwd) matches the updated fixture
            const second = await cli
                .fixture(directory('../../shared/fixtures/specimen-cli/'))
                .exec('version');
            expect(second.stdout).toMatch(file(`./expected/${fixtureName}`));
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });

    test('update mode preserves placeholder-covered lines', async () => {
        // Given - an existing fixture whose token lines still match
        const fixtureName = `version-preserve-${Date.now()}.txt`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            const { writeFileSync, mkdirSync } = await import('node:fs');
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(
                fixturePath,
                'cli-app v{{semver}}\nSTALE LINE\ncwd {{workdir}}\ndone in {{duration}}\n',
            );

            // When - update mode rewrites from actual output
            const result = await cli
                .fixture(directory('../../shared/fixtures/specimen-cli/'))
                .exec('version');
            vi.stubEnv('TEST_UPDATE', '1');
            try {
                expect(result.stdout).toMatch(file(`./expected/${fixtureName}`));
            } finally {
                vi.unstubAllEnvs();
            }

            // Then - token lines survived, the stale literal was replaced
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toContain('cli-app v{{semver}}');
            expect(written).toContain('cwd {{workdir}}');
            expect(written).toContain('done in {{duration}}');
            expect(written).not.toContain('STALE LINE');
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });
});
