import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cliSpec } from '../../setup/cli.specification.js';

describe('cli — stdout accessor', () => {
    test('text exposes the raw string', async () => {
        const result = await cliSpec('stdout text').project('cli-app').exec('help').run();

        expect(result.stdout.text).toContain('Usage: cli <command>');
    });

    test('coerces to primitive string via String()', async () => {
        const result = await cliSpec('stdout coerce').project('cli-app').exec('help').run();

        expect(String(result.stdout)).toContain('Usage:');
        expect(`${result.stdout}`).toContain('Usage:');
    });

    test('toMatchFile passes on identical content', async () => {
        const temp = mkdtempSync(resolve(tmpdir(), 'stdout-match-'));
        const expectedFile = resolve(temp, 'stdout.txt');
        try {
            const a = await cliSpec('stdout file seed').project('cli-app').exec('json').run();
            // Seed the file using update mode, then verify.
            a.stdout.toMatchFile(expectedFile, { update: true });

            const b = await cliSpec('stdout file verify').project('cli-app').exec('json').run();
            b.stdout.toMatchFile(expectedFile);
        } finally {
            rmSync(temp, { force: true, recursive: true });
        }
    });

    test('toMatchFile fails with a diff on mismatch', async () => {
        const temp = mkdtempSync(resolve(tmpdir(), 'stdout-mismatch-'));
        const expectedFile = resolve(temp, 'stdout.txt');
        try {
            const a = await cliSpec('stdout seed').project('cli-app').exec('json').run();
            a.stdout.toMatchFile(expectedFile, { update: true });

            // Overwrite with something else, then verify should fail.
            const { writeFileSync } = await import('node:fs');
            writeFileSync(expectedFile, 'different\n');

            const b = await cliSpec('stdout verify').project('cli-app').exec('json').run();
            expect(() => b.stdout.toMatchFile(expectedFile)).toThrow(/Output mismatch/);
        } finally {
            rmSync(temp, { force: true, recursive: true });
        }
    });

    test('toMatch resolves to expected/stdout/<name>.txt', async () => {
        const fixtureName = `stdout-transient-${Date.now()}`;
        try {
            const a = await cliSpec('stdout fixture seed').project('cli-app').exec('json').run();
            a.stdout.toMatch(fixtureName, { update: true });

            const b = await cliSpec('stdout fixture verify').project('cli-app').exec('json').run();
            b.stdout.toMatch(fixtureName);
        } finally {
            rmSync(resolve(import.meta.dirname, 'expected', 'stdout', `${fixtureName}.txt`), {
                force: true,
            });
        }
    });
});

describe('cli — stderr accessor', () => {
    test('text exposes stderr content', async () => {
        const result = await cliSpec('stderr text').project('cli-app').exec('fail').run();

        expect(result.stderr.text).toContain('Fatal: something went wrong');
    });

    test('toMatchFile round-trips', async () => {
        const temp = mkdtempSync(resolve(tmpdir(), 'stderr-'));
        const file = resolve(temp, 'stderr.txt');
        try {
            const a = await cliSpec('stderr seed').project('cli-app').exec('fail').run();
            a.stderr.toMatchFile(file, { update: true });

            const b = await cliSpec('stderr verify').project('cli-app').exec('fail').run();
            b.stderr.toMatchFile(file);
        } finally {
            rmSync(temp, { force: true, recursive: true });
        }
    });
});

describe('cli — json accessor', () => {
    test('value exposes the parsed JSON', async () => {
        const result = await cliSpec('json value').project('cli-app').exec('json').run();

        expect(result.json.value).toEqual({
            name: 'cli-app',
            version: '1.0.0',
            features: ['build', 'check'],
        });
    });

    test('toMatchFile round-trips with pretty-printed JSON', async () => {
        const temp = mkdtempSync(resolve(tmpdir(), 'json-match-'));
        const file = resolve(temp, 'expected.json');
        try {
            const a = await cliSpec('json seed').project('cli-app').exec('json').run();
            a.json.toMatchFile(file, { update: true });

            const written = readFileSync(file, 'utf8');
            expect(written).toMatch(/^\{\n {4}"name": "cli-app"/);
            expect(written.endsWith('\n')).toBe(true);

            const b = await cliSpec('json verify').project('cli-app').exec('json').run();
            b.json.toMatchFile(file);
        } finally {
            rmSync(temp, { force: true, recursive: true });
        }
    });

    test('toMatch resolves to expected/json/<name>.json', async () => {
        const fixtureName = `json-transient-${Date.now()}`;
        try {
            const a = await cliSpec('json fixture seed').project('cli-app').exec('json').run();
            a.json.toMatch(fixtureName, { update: true });

            const b = await cliSpec('json fixture verify').project('cli-app').exec('json').run();
            b.json.toMatch(fixtureName);
        } finally {
            rmSync(resolve(import.meta.dirname, 'expected', 'json', `${fixtureName}.json`), {
                force: true,
            });
        }
    });

    test('throws a clear error when stdout is not JSON', async () => {
        const result = await cliSpec('json bad').project('cli-app').exec('help').run();

        expect(() => result.json.value).toThrow(/stdout is not valid JSON/);
    });
});

describe('cli — filesystem accessor', () => {
    test('cwd points to the temp working directory', async () => {
        const result = await cliSpec('fs cwd').project('cli-app').exec('scaffold').run();

        expect(result.filesystem.cwd).toMatch(/spec-cli-/);
    });

    test('files() lists the whole tree sorted, filtering defaults', async () => {
        const result = await cliSpec('fs files').project('cli-app').exec('scaffold').run();

        const files = await result.filesystem.files();
        // Cli.sh is copied in via .project(), scaffold writes out/** — both appear.
        expect(files).toContain('cli.sh');
        expect(files).toContain('out/main.go');
        expect(files).toContain('out/docs/README.md');
        // Sorted
        expect([...files].sort()).toEqual(files);
    });

    test('toMatch round-trips the entire working dir', async () => {
        const fixtureName = `fs-transient-${Date.now()}`;
        try {
            const a = await cliSpec('fs fixture seed').project('cli-app').exec('scaffold').run();
            await a.filesystem.toMatch(fixtureName, { update: true });

            const b = await cliSpec('fs fixture verify').project('cli-app').exec('scaffold').run();
            await b.filesystem.toMatch(fixtureName);
        } finally {
            rmSync(resolve(import.meta.dirname, 'expected', 'filesystem', fixtureName), {
                force: true,
                recursive: true,
            });
        }
    });

    test('toMatch detects a diff', async () => {
        const fixtureName = `fs-diff-${Date.now()}`;
        try {
            const a = await cliSpec('fs diff seed').project('cli-app').exec('scaffold').run();
            await a.filesystem.toMatch(fixtureName, { update: true });

            const b = await cliSpec('fs diff verify')
                .project('cli-app')
                .exec('scaffold-changed')
                .run();
            await expect(b.filesystem.toMatch(fixtureName)).rejects.toThrow(/Directory mismatch/);
        } finally {
            rmSync(resolve(import.meta.dirname, 'expected', 'filesystem', fixtureName), {
                force: true,
                recursive: true,
            });
        }
    });
});

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '');

describe('cli — transform option', () => {
    test('transform strips ANSI from stdout before toMatchFile comparison', async () => {
        const { command, spec } = await import('../../../src/index.js');
        const cliBin = resolve(import.meta.dirname, '../../setup/fixtures/cli-app/cli.sh');
        const customSpec = await spec(command(cliBin), { transform: stripAnsi });

        const temp = mkdtempSync(resolve(tmpdir(), 'transform-stdout-'));
        const fixturePath = resolve(temp, 'expected.txt');
        try {
            // Hand-write the fixture WITHOUT ANSI codes.
            const { writeFileSync } = await import('node:fs');
            writeFileSync(fixturePath, 'red plain bold\n');

            const result = await customSpec('ansi stdout').exec('ansi').run();

            // Raw .text still contains the original ANSI escapes.
            expect(result.stdout.text).toContain('\x1b[31m');
            expect(result.stdout.text).toContain('\x1b[0m');

            // Comparison passes because the transform stripped ANSI from the actual.
            expect(() => result.stdout.toMatchFile(fixturePath)).not.toThrow();
        } finally {
            rmSync(temp, { force: true, recursive: true });
            await customSpec.cleanup();
        }
    });

    test('transform does NOT mutate result.stdout.text', async () => {
        const { command, spec } = await import('../../../src/index.js');
        const cliBin = resolve(import.meta.dirname, '../../setup/fixtures/cli-app/cli.sh');
        const customSpec = await spec(command(cliBin), { transform: stripAnsi });

        try {
            const result = await customSpec('ansi raw').exec('ansi').run();
            // Pristine output preserved.
            expect(result.stdout.text).toBe('\x1b[31mred\x1b[0m plain \x1b[1mbold\x1b[0m\n');
        } finally {
            await customSpec.cleanup();
        }
    });

    test('transform only runs on actual, never on fixture', async () => {
        const { command, spec } = await import('../../../src/index.js');
        const cliBin = resolve(import.meta.dirname, '../../setup/fixtures/cli-app/cli.sh');
        // Transform strips the word "plain" entirely.
        const customSpec = await spec(command(cliBin), {
            transform: (t) => t.replace(/ plain/g, ''),
        });

        const temp = mkdtempSync(resolve(tmpdir(), 'transform-asymmetric-'));
        const fixturePath = resolve(temp, 'expected.txt');
        try {
            const { writeFileSync } = await import('node:fs');
            // Fixture lacks " plain" — matches what the transform produces from actual.
            writeFileSync(fixturePath, '\x1b[31mred\x1b[0m \x1b[1mbold\x1b[0m\n');

            const result = await customSpec('asymmetric').exec('ansi').run();
            // Passes only because fixture is authoritative — NOT transformed.
            expect(() => result.stdout.toMatchFile(fixturePath)).not.toThrow();

            // Prove the fixture is not transformed: if we re-read it, it still has " plain"-less
            // Content which means our assertion succeeded against the raw (post-actual-transform) value.
            const { readFileSync: rf } = await import('node:fs');
            expect(rf(fixturePath, 'utf8')).not.toContain(' plain');
        } finally {
            rmSync(temp, { force: true, recursive: true });
            await customSpec.cleanup();
        }
    });

    test('transform writes the post-normalisation form when updating', async () => {
        const { command, spec } = await import('../../../src/index.js');
        const cliBin = resolve(import.meta.dirname, '../../setup/fixtures/cli-app/cli.sh');
        const customSpec = await spec(command(cliBin), { transform: stripAnsi });

        const temp = mkdtempSync(resolve(tmpdir(), 'transform-update-'));
        const fixturePath = resolve(temp, 'expected.txt');
        try {
            const result = await customSpec('update mode').exec('ansi').run();
            result.stdout.toMatchFile(fixturePath, { update: true });

            const written = readFileSync(fixturePath, 'utf8');
            // No ANSI in the fixture — transform ran before write.
            expect(written).toBe('red plain bold\n');
            expect(written).not.toContain('\x1b[');
        } finally {
            rmSync(temp, { force: true, recursive: true });
            await customSpec.cleanup();
        }
    });

    test('JsonAccessor applies transform before JSON.parse', async () => {
        const { command, spec } = await import('../../../src/index.js');
        const cliBin = resolve(import.meta.dirname, '../../setup/fixtures/cli-app/cli.sh');
        const customSpec = await spec(command(cliBin), { transform: stripAnsi });

        try {
            const result = await customSpec('ansi json').exec('ansi-json').run();

            // Raw stdout still has ANSI wrapping the JSON — would NOT parse.
            expect(result.stdout.text).toContain('\x1b[32m');

            // But .json.value works because the transform stripped ANSI before parse.
            expect(result.json.value).toEqual({ status: 'ok', value: 42 });
        } finally {
            await customSpec.cleanup();
        }
    });
});

describe('cli — seed handlers', () => {
    test('dispatches a seed to a user-provided handler by leading segment', async () => {
        // Given - a dedicated spec runner with seedHandlers that writes files into cwd
        const { command, spec } = await import('../../../src/index.js');
        const cliBin = resolve(import.meta.dirname, '../../setup/fixtures/cli-app/cli.sh');

        const customSpec = await spec(command(cliBin), {
            root: resolve(import.meta.dirname, '../../setup/fixtures'),
            seedHandlers: {
                'spwn.yaml/': async (ctx, fragmentPath) => {
                    const { copyFileSync, writeFileSync } = await import('node:fs');
                    // Merge: read fragment, write to ctx.cwd/spwn.yaml
                    const content = readFileSync(fragmentPath, 'utf8');
                    writeFileSync(resolve(ctx.cwd, 'spwn.yaml'), content);
                    // Touch copyFileSync to assert import path works
                    void copyFileSync;
                },
                'agent/': async (ctx, fragmentPath) => {
                    const { cpSync, mkdirSync } = await import('node:fs');
                    // Copy the fragment (file or dir) under ctx.cwd/spwn/agents/
                    const rel = fragmentPath.split('/seeds/agent/')[1] ?? 'unknown';
                    const dest = resolve(ctx.cwd, 'spwn/agents', rel);
                    mkdirSync(resolve(dest, '..'), { recursive: true });
                    cpSync(fragmentPath, dest, { recursive: true });
                },
            },
        });

        try {
            // Materialize seed source files under the test-file's seeds/ dir
            const { mkdirSync, writeFileSync } = await import('node:fs');
            const baseSeeds = resolve(import.meta.dirname, 'seeds');
            mkdirSync(resolve(baseSeeds, 'spwn.yaml'), { recursive: true });
            mkdirSync(resolve(baseSeeds, 'agent/neo/journal'), { recursive: true });
            writeFileSync(
                resolve(baseSeeds, 'spwn.yaml/two-worlds.yaml'),
                'worlds:\n  - alpha\n  - beta\n',
            );
            writeFileSync(resolve(baseSeeds, 'agent/neo/journal/session-1.md'), '# session 1\n');

            try {
                const result = await customSpec('seeded cli')
                    .project('cli-app')
                    .seed('spwn.yaml/two-worlds.yaml')
                    .seed('agent/neo/journal/session-1.md')
                    .exec('read-seed')
                    .run();

                expect(result.exitCode).toBe(0);
                expect(result.stdout.text).toContain('worlds:');
                expect(result.stdout.text).toContain('alpha');
                expect(result.stdout.text).toContain('spwn/agents/neo/journal/session-1.md');
            } finally {
                rmSync(baseSeeds, { force: true, recursive: true });
            }
        } finally {
            await customSpec.cleanup();
        }
    });
});
