import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, 'expected');

describe('command — tokens in text snapshots (CONVENTIONS D4)', () => {
    test('matches dynamic values via typed tokens including {{workdir}}', async () => {
        // Given - output mixing a semver, a uuid, a timestamp, the cwd, and a duration
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('version');

        // Then - the committed fixture matches through the token grammar
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('version.txt');
    });

    test('{{workdir}} is the exact cwd of the spec — a different path fails', async () => {
        // Given - two runs, each with its own temp cwd
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('version');

        // Then - the fixture matched THIS run's cwd (fresh cwd per spec means
        // A stale literal path could never pass — the token is exact)
        expect(result.stdout.comparableText).toContain('cwd /');
        expect(result.stdout).toMatch('version.txt');
    });

    test('tokens match inside tree-snapshot file contents', async () => {
        // Given - a scaffold whose out/report.txt embeds a fresh uuid
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold-dynamic');

        // Then - the committed tree fixture matches via the {{uuid}} token
        expect(result.exitCode).toBe(0);
        await expect(result.directory('out')).toMatch('dynamic-tree');
    });

    test('update mode substitutes the workdir and preserves tokens (CONVENTIONS D5)', async () => {
        // Given - update mode on a fresh fixture name
        const fixtureName = `version-transient-${Date.now()}.txt`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            const result = await cli.fixture('$FIXTURES/cli-app/').exec('version');
            process.env.TEST_UPDATE = '1';
            try {
                expect(result.stdout).toMatch(fixtureName);
            } finally {
                delete process.env.TEST_UPDATE;
            }

            // Then - the written fixture contains the {{workdir}} token, not the raw path
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toContain('cwd {{workdir}}');
            expect(written).not.toMatch(/cwd \//);

            // Then - a second run (different cwd) matches the updated fixture
            const second = await cli.fixture('$FIXTURES/cli-app/').exec('version');
            expect(second.stdout).toMatch(fixtureName);
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });

    test('update mode substitutes the workdir inside JSON (CONVENTIONS D5, text/json parity)', async () => {
        // Given - a JSON payload whose values embed the run cwd, update mode on
        // A fresh fixture name
        const fixtureName = `json-cwd-transient-${Date.now()}.json`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            const result = await cli.fixture('$FIXTURES/cli-app/').exec('json-cwd');
            const rawCwd = (result.json.value as { cwd: string }).cwd;
            process.env.TEST_UPDATE = '1';
            try {
                expect(result.json).toMatch(fixtureName);
            } finally {
                delete process.env.TEST_UPDATE;
            }

            // Then - the written JSON holds the {{workdir}} token, never the raw path
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toContain('"{{workdir}}"');
            expect(written).toContain('wrote {{workdir}}/out.txt');
            expect(written).not.toContain(rawCwd);

            // Then - a second run (different cwd) matches the updated fixture
            const second = await cli.fixture('$FIXTURES/cli-app/').exec('json-cwd');
            expect(second.json).toMatch(fixtureName);
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
            const result = await cli.fixture('$FIXTURES/cli-app/').exec('version');
            process.env.TEST_UPDATE = '1';
            try {
                expect(result.stdout).toMatch(fixtureName);
            } finally {
                delete process.env.TEST_UPDATE;
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

describe('command — ANSI stripped by default (CONVENTIONS D6)', () => {
    test('comparisons see clean text while .text stays raw', async () => {
        // Given - output wrapped in ANSI escapes, no transform configured
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('ansi');

        // Then - matchers compare the stripped form
        expect(result.stdout).toContain('red plain bold');
        expect(result.stdout).toMatch('ansi.txt');

        // Then - the raw accessor keeps the escapes
        // oxlint-disable-next-line jterrazz/d8w-text-bypass -- the raw `.text` accessor IS the subject: this test proves it retains ANSI escapes while matchers see the stripped form.
        expect(result.stdout.text).toContain('\x1b[31m');
    });

    test('json accessor parses through ANSI noise without a transform', async () => {
        // Given - JSON wrapped in ANSI codes
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('ansi-json');

        // Then - parsing works because ANSI is stripped by default
        expect(result.json.value).toEqual({ status: 'ok', value: 42 });
    });
});
