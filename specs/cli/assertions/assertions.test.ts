import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { text } from '../../../src/index.js';
import { cli as asymmetricCli } from '../asymmetric-transform-cli.specification.js';
import { cli } from '../cli.specification.js';
import { cli as transformCli } from '../transform-cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, 'expected');

/** Run a block with TEST_UPDATE=1 so toMatch writes the fixture. */
function inUpdateMode(block: () => void): void {
    process.env.TEST_UPDATE = '1';
    try {
        block();
    } finally {
        delete process.env.TEST_UPDATE;
    }
}

/** Run an assertion expected to fail and return its thrown message. */
function catchMessage(assertion: () => unknown): string {
    try {
        assertion();
    } catch (error) {
        return (error as Error).message;
    }
    throw new Error('expected the assertion to throw, but it passed');
}

/*
 * This file is the framework's own matcher/accessor self-test: the toContain probes
 * demonstrate the .text/.toContain/.file accessors and matcher behaviour themselves —
 * the fixture CLI's output is the vehicle, not the assertion target. Whole-output
 * correctness is exercised by the toMatch('<file>') golden cases throughout.
 */
/* oxlint-disable jterrazz/d8w-text-bypass -- The raw `.text` accessor IS the subject
   under test here (see the note above); every `.text` assertion is deliberate, not a
   bypass. Whole-output goldens are covered by the toMatch('<file>') cases in this file. */

describe('command — stdout accessor', () => {
    test('text exposes the raw string', async () => {
        // Given - a help run
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('help');

        // Then - raw text is readable
        expect(result.stdout.text).toContain('Usage: cli <command>');
    });

    test('coerces to primitive string via String()', async () => {
        // Given - a help run
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('help');

        // Then - toString/valueOf keep string coercion working
        expect(String(result.stdout)).toContain('Usage:');
        expect(`${result.stdout}`).toContain('Usage:');
    });

    test('toMatch writes with TEST_UPDATE then passes on identical content', async () => {
        // Given - a fixture created via update mode
        const fixtureName = `stdout-transient-${Date.now()}.txt`;
        try {
            const a = await cli.fixture('$FIXTURES/cli-app/').exec('json');
            inUpdateMode(() => expect(a.stdout).toMatch(fixtureName));

            // Then - a second identical run matches expected/<name> (flat)
            const b = await cli.fixture('$FIXTURES/cli-app/').exec('json');
            expect(b.stdout).toMatch(fixtureName);
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true });
        }
    });

    test('toMatch fails with a diff on mismatch', async () => {
        // Given - a fixture that differs from the actual output
        const fixtureName = `stdout-mismatch-${Date.now()}.txt`;
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(resolve(EXPECTED_DIR, fixtureName), 'different\n');

            // Then - the matcher reports an output diff (frozen: assert the diff even under TEST_UPDATE)
            const result = await cli.fixture('$FIXTURES/cli-app/').exec('json');
            expect(() => expect(result.stdout).toMatch(fixtureName, { frozen: true })).toThrow(
                /Output mismatch/,
            );
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true });
        }
    });

    test('the stdout mismatch diff is goldened in full (failure-message quality is the product)', async () => {
        // Given - a run whose output differs from a committed, deliberately-wrong fixture
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('help');

        // Then - the whole -/+ stdout diff is captured and asserted against a golden.
        // Frozen - stdout-wrong.txt is deliberately wrong (its diff IS the subject); only the
        // Error golden updates, never the wrong fixture
        const message = catchMessage(() =>
            expect(result.stdout).toMatch('stdout-wrong.txt', { frozen: true }),
        );
        expect(text(message)).toMatch('errors/stdout-diff-error.txt');
    });

    test('a frozen fixture is never rewritten under TEST_UPDATE (negative-fixture guard)', async () => {
        // Given - a deliberately-wrong fixture whose diff is the behaviour under test
        const fixtureName = `frozen-wrong-${Date.now()}.txt`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(fixturePath, 'deliberately wrong\n');
            const result = await cli.fixture('$FIXTURES/cli-app/').exec('json');

            // Then - even in update mode, a frozen mismatch still throws its diff and never writes
            inUpdateMode(() => {
                expect(() => expect(result.stdout).toMatch(fixtureName, { frozen: true })).toThrow(
                    /Output mismatch/,
                );
            });
            expect(readFileSync(fixturePath, 'utf8')).toBe('deliberately wrong\n');
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });

    test('toMatch on a missing stream fixture mentions TEST_UPDATE', async () => {
        // Given - a fixture name that was never created
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('help');

        // Then - the failure explains how to create the fixture
        // Frozen - under TEST_UPDATE the missing fixture must still throw rather than be created
        // oxlint-disable-next-line jterrazz/c8-referenced-fixture-exists -- negative spec: the missing fixture IS the behaviour under test
        expect(() => expect(result.stdout).toMatch('never-created.txt', { frozen: true })).toThrow(
            /does not exist[\s\S]*TEST_UPDATE=1/,
        );
    });

    test('a slash in the fixture name creates a subfolder under expected/', async () => {
        // Given - a fixture written via update mode with a slash in its name
        const fixtureName = `sub/help-${Date.now()}.txt`;
        try {
            const a = await cli.fixture('$FIXTURES/cli-app/').exec('help');
            inUpdateMode(() => expect(a.stdout).toMatch(fixtureName));

            // Then - the file landed at expected/sub/<name> and matches on re-run
            expect(existsSync(resolve(EXPECTED_DIR, fixtureName))).toBe(true);
            const b = await cli.fixture('$FIXTURES/cli-app/').exec('help');
            expect(b.stdout).toMatch(fixtureName);
        } finally {
            rmSync(resolve(EXPECTED_DIR, 'sub'), { force: true, recursive: true });
        }
    });

    test('toMatch requires the extension in the name', async () => {
        // Given - a fixture name without extension
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('json');

        // Then - the matcher enforces CONVENTIONS C6
        // Frozen - a negative assertion; keep it update-safe alongside the rest of the sweep
        // oxlint-disable-next-line jterrazz/c6-tomatch-extension, jterrazz/c8-referenced-fixture-exists -- negative spec: the missing extension IS the behaviour under test
        expect(() => expect(result.stdout).toMatch('no-extension', { frozen: true })).toThrow(
            /extension is part of the name/,
        );
    });

    test('toContain matcher checks the captured text', async () => {
        // Given - a help run
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('help');

        // Then - expect().toContain works on the accessor and stays native for strings/arrays
        expect(result.stdout).toContain('Usage: cli <command>');
        expect(() => expect(result.stdout).toContain('NOT_THERE')).toThrow(
            /does not contain expected substring/,
        );
        expect('plain string').toContain('plain');
        expect(['a', 'b']).toContain('b');
    });
});

describe('command — stderr accessor', () => {
    test('text exposes stderr content', async () => {
        // Given - a failing run
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('fail');

        // Then - stderr text is readable
        expect(result.stderr.text).toContain('Fatal: something went wrong');
    });

    test('toMatch round-trips', async () => {
        // Given - a stderr fixture created via update mode
        const fixtureName = `stderr-transient-${Date.now()}.txt`;
        try {
            const a = await cli.fixture('$FIXTURES/cli-app/').exec('fail');
            inUpdateMode(() => expect(a.stderr).toMatch(fixtureName));

            // Then - a second identical run matches
            const b = await cli.fixture('$FIXTURES/cli-app/').exec('fail');
            expect(b.stderr).toMatch(fixtureName);
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true });
        }
    });
});

describe('command — json accessor', () => {
    test('value exposes the parsed JSON', async () => {
        // Given - a run printing JSON
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('json');

        // Then - the parsed value is readable
        expect(result.json.value).toEqual({
            features: ['build', 'check'],
            name: 'cli-app',
            version: '1.0.0',
        });
    });

    test('toMatch round-trips with pretty-printed JSON', async () => {
        // Given - a JSON fixture created via update mode
        const fixtureName = `json-transient-${Date.now()}.json`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            const a = await cli.fixture('$FIXTURES/cli-app/').exec('json');
            inUpdateMode(() => expect(a.json).toMatch(fixtureName));

            // Then - the file is pretty-printed with a trailing newline
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toMatch(/^\{\n {4}"name": "cli-app"/);
            expect(written.endsWith('\n')).toBe(true);

            // Then - a second identical run matches
            const b = await cli.fixture('$FIXTURES/cli-app/').exec('json');
            expect(b.json).toMatch(fixtureName);
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });

    test('toMatch supports placeholders in expected JSON', async () => {
        // Given - a fixture using {{string}} / {{number}} / {{any}} placeholders
        const fixtureName = `json-placeholders-${Date.now()}.json`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(
                fixturePath,
                `${JSON.stringify(
                    { features: '{{any}}', name: '{{string#n}}', version: '{{string}}' },
                    null,
                    4,
                )}\n`,
            );

            // Then - dynamic segments match by type
            const result = await cli.fixture('$FIXTURES/cli-app/').exec('json');
            expect(result.json).toMatch(fixtureName);
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });

    test('update mode preserves placeholder-covered segments', async () => {
        // Given - an existing fixture with a placeholder plus a stale literal
        const fixtureName = `json-preserve-${Date.now()}.json`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(
                fixturePath,
                `${JSON.stringify(
                    { features: ['build', 'check'], name: '{{string}}', version: 'STALE' },
                    null,
                    4,
                )}\n`,
            );

            // When - update mode rewrites the fixture from actual output
            const result = await cli.fixture('$FIXTURES/cli-app/').exec('json');
            inUpdateMode(() => expect(result.json).toMatch(fixtureName));

            // Then - the placeholder survived, the stale literal was replaced
            const written = JSON.parse(readFileSync(fixturePath, 'utf8'));
            expect(written.name).toBe('{{string}}');
            expect(written.version).toBe('1.0.0');
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });

    test('throws a clear error when stdout is not JSON', async () => {
        // Given - non-JSON output
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('help');

        // Then - reading .value throws with context
        expect(() => result.json.value).toThrow(/stdout is not valid JSON/);
    });
});

describe('command — filesystem accessor', () => {
    test('cwd points to the temp working directory', async () => {
        // Given - a scaffold run
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');

        // Then - cwd is the isolated temp dir
        expect(result.filesystem.cwd).toMatch(/spec-command-/);
    });

    test('files() lists the whole tree sorted, filtering defaults', async () => {
        // Given - a scaffold run
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');

        // Then - cli.sh (spread via .fixture('$FIXTURES/cli-app/')) and scaffold output both appear, sorted
        const files = await result.filesystem.files();
        expect(files).toContain('cli.sh');
        expect(files).toContain('out/main.go');
        expect(files).toContain('out/docs/README.md');
        expect([...files].sort()).toEqual(files);
    });

    test('toMatch round-trips the entire working dir', async () => {
        // Given - a tree fixture created via update mode (flat under expected/)
        const fixtureName = `fs-transient-${Date.now()}`;
        try {
            const a = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');
            process.env.TEST_UPDATE = '1';
            try {
                await expect(a.filesystem).toMatch(fixtureName);
            } finally {
                delete process.env.TEST_UPDATE;
            }

            // Then - a second identical run matches
            const b = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');
            await expect(b.filesystem).toMatch(fixtureName);
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true, recursive: true });
        }
    });

    test('toMatch detects a diff', async () => {
        // Given - a fixture from scaffold, compared against scaffold-changed
        const fixtureName = `fs-diff-${Date.now()}`;
        try {
            const a = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold');
            process.env.TEST_UPDATE = '1';
            try {
                await expect(a.filesystem).toMatch(fixtureName);
            } finally {
                delete process.env.TEST_UPDATE;
            }

            // Then - the changed tree fails with a directory diff. Frozen: the fixture written
            // Above must not be overwritten with the changed tree under TEST_UPDATE
            const b = await cli.fixture('$FIXTURES/cli-app/').exec('scaffold-changed');
            await expect(
                expect(b.filesystem).toMatch(fixtureName, { frozen: true }),
            ).rejects.toThrow(/Directory mismatch/);
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true, recursive: true });
        }
    });
});

describe('command — fixture setup', () => {
    test('copies fixture file into working dir before exec', async () => {
        // Given - fixture file that triggers check failure
        const result = await cli.fixture('$FIXTURES/cli-app/').fixture('invalid.ts').exec('check');

        // Then - check detected the invalid file
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('unused-var');
    });

    test('clean project has no invalid files', async () => {
        // Given - the pristine project fixture
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('check');

        // Then - check passes
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('All checks passed');
    });
});

describe('command — file accessor', () => {
    test('exists check', async () => {
        // Given - build creates files
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('build');

        // Then - file exists and absent file doesn't
        expect(result.file('dist/index.js').exists).toBe(true);
        expect(result.file('dist/nonexistent.js').exists).toBe(false);
    });

    test('content check', async () => {
        // Given - build creates files
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('build');

        // Then - file contains expected content
        expect(result.file('dist/index.js').content).toContain('Hello from CLI app');
    });

    test('chains multiple assertions on one result', async () => {
        // Given - a successful build
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('build');

        // Then - several read accessors on one result
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Build completed');
        expect(result.file('dist/index.js').exists).toBe(true);
        expect(result.file('dist/manifest.json').exists).toBe(true);
        expect(result.file('dist/index.cjs').exists).toBe(false);
        expect(result.file('dist/index.js').content).toContain('Hello from CLI app');
    });
});

describe('command — transform option', () => {
    test('transform strips ANSI from stdout before toMatch comparison', async () => {
        // Given - a runner with an ANSI-stripping transform and a clean fixture
        const fixtureName = `transform-clean-${Date.now()}.txt`;
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(resolve(EXPECTED_DIR, fixtureName), 'red plain bold\n');

            const result = await transformCli.exec('ansi');

            // Then - raw .text still contains the original ANSI escapes
            expect(result.stdout.text).toContain('\x1b[31m');
            expect(result.stdout.text).toContain('\x1b[0m');

            // Then - comparison passes because the transform stripped ANSI from the actual
            expect(result.stdout).toMatch(fixtureName);
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true });
        }
    });

    test('transform does NOT mutate result.stdout.text', async () => {
        // Given - a runner with an ANSI-stripping transform
        const result = await transformCli.exec('ansi');

        // Then - pristine output preserved
        expect(result.stdout.text).toBe('\x1b[31mred\x1b[0m plain \x1b[1mbold\x1b[0m\n');
    });

    test('transform only runs on actual, never on fixture', async () => {
        // Given - a transform that strips the word " plain" (ANSI is already
        // Stripped by default), and a fixture matching the transformed form
        const fixtureName = `transform-asymmetric-${Date.now()}.txt`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            // Fixture lacks " plain" — matches what the transform produces from actual.
            writeFileSync(fixturePath, 'red bold\n');

            const result = await asymmetricCli.exec('ansi');

            // Then - passes only because the fixture is authoritative — NOT transformed
            expect(result.stdout).toMatch(fixtureName);
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
            inUpdateMode(() => expect(result.stdout).toMatch(fixtureName));

            // Then - no ANSI in the fixture — transform ran before write
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toBe('red plain bold\n');
            expect(written).not.toContain('\x1b[');
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });

    test('the json accessor applies transform before JSON.parse', async () => {
        // Given - JSON output wrapped in ANSI codes
        const result = await transformCli.exec('ansi-json');

        // Then - raw stdout still has ANSI wrapping the JSON — would NOT parse
        expect(result.stdout.text).toContain('\x1b[32m');

        // Then - .json.value works because the transform stripped ANSI before parse
        expect(result.json.value).toEqual({ status: 'ok', value: 42 });
    });
});

describe('command — fixture tree layering', () => {
    test('layers a shared project and a feature-local file tree into the cwd', async () => {
        // Given - the shared cli-app project spread first, then a feature-local
        // Tree (spwn.yaml + spwn/agents/…) laid out exactly as the cwd should look
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .fixture('spwn-seed/')
            .exec('read-seed');

        // Then - the CLI saw both layers as one merged tree: the config file and the nested tree
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('read-seed.txt');
    });

    test('a directory fixture without a trailing slash lands under its basename', async () => {
        // Given - the shared cli-app project spread WITHOUT a trailing slash
        const result = await cli.fixture('$FIXTURES/cli-app').exec('help');

        // Then - rsync semantics: the directory is copied under its own name
        // (cwd/cli-app/…), NOT spread into the cwd
        expect(result.exitCode).toBe(0);
        expect(result.file('cli-app/cli.sh').exists).toBe(true);
        expect(result.file('cli.sh').exists).toBe(false);
    });

    test('a later .fixture() overwrites an earlier file (last write wins)', async () => {
        // Given - two feature-local trees that both write spwn.yaml, layered in order
        const result = await cli.fixture('layer-base/').fixture('layer-override/').exec('help');

        // Then - the later fixture's spwn.yaml overwrote the earlier one
        expect(result.exitCode).toBe(0);
        expect(result.file('spwn.yaml').content).toContain('override-world');
        expect(result.file('spwn.yaml').content).not.toContain('base-world');
    });
});
