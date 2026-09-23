import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { directory, file, text } from '../../../src/index.js';
import { cli as asymmetricCli } from '../asymmetric-transform-cli.specification.js';
import { cli } from '../cli.specification.js';
import { cli as transformCli } from '../transform-cli.specification.js';
import { cli as vitestCli } from '../vitest-cli.specification.js';

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
 * demonstrate the .text/.raw/.file accessors and matcher behaviour themselves —
 * the fixture CLI's output is the vehicle, not the assertion target. Whole-output
 * correctness is exercised by the toMatch(file(…)) golden cases throughout.
 */
/* oxlint-disable jterrazz/d8w-raw-bypass -- The raw `.raw` accessor IS the subject
   under test here (see the note above): every `.raw` assertion proves what the
   comparison strips. Whole-output goldens are the toMatch(file(…)) cases in this file. */

describe('command — stdout accessor', () => {
    test('text exposes the comparable string', async () => {
        // Given - a help run
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('help');

        // Then - the text is readable
        expect(result.stdout.text).toContain('Usage: cli <command>');
    });

    test('coerces to primitive string via String()', async () => {
        // Given - a help run
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('help');

        // Then - toString/valueOf keep string coercion working
        expect(String(result.stdout)).toContain('Usage:');
        expect(`${result.stdout}`).toContain('Usage:');
    });

    test('toMatch writes with TEST_UPDATE then passes on identical content', async () => {
        // Given - a fixture created via update mode
        const fixtureName = `stdout-transient-${Date.now()}.txt`;
        try {
            const a = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');
            inUpdateMode(() => {
                expect(a.stdout).toMatch(file(`./expected/${fixtureName}`));
            });

            // Then - a second identical run matches expected/<name> (flat)
            const b = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');
            expect(b.stdout).toMatch(file(`./expected/${fixtureName}`));
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
            const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');
            expect(() => {
                expect(result.stdout).toMatch(file(`./expected/${fixtureName}`), { frozen: true });
            }).toThrow(/Output mismatch/u);
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true });
        }
    });

    test('the stdout mismatch diff is goldened in full (failure-message quality is the product)', async () => {
        // Given - a run whose output differs from a committed, deliberately-wrong fixture
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('help');

        // Then - the whole -/+ stdout diff is captured and asserted against a golden. frozen - stdout-wrong.txt is deliberately wrong (its diff IS the subject); only the error golden updates, never the wrong fixture
        const message = catchMessage(() => {
            expect(result.stdout).toMatch(
                `
                Usage: cli <command>

                Commands:
                  build   Compile the project
                  check   Check code quality
            `,
                { frozen: true },
            );
        });
        expect(text(message)).toMatch(
            'Output mismatch (the value in place)\n\n- Expected\n+ Received\n\n  Usage: cli <command>\n  \n  Commands:\n-   build   Compile the project\n+   build   Build the project\n    check   Check code quality\n  ',
        );
    });

    test('a frozen fixture is never rewritten under TEST_UPDATE (negative-fixture guard)', async () => {
        // Given - a deliberately-wrong fixture whose diff is the behaviour under test
        const fixtureName = `frozen-wrong-${Date.now()}.txt`;
        const fixturePath = resolve(EXPECTED_DIR, fixtureName);
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(fixturePath, 'deliberately wrong\n');
            const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');

            // Then - even in update mode, a frozen mismatch still throws its diff and never writes
            inUpdateMode(() => {
                expect(() => {
                    expect(result.stdout).toMatch(file(`./expected/${fixtureName}`), {
                        frozen: true,
                    });
                }).toThrow(/Output mismatch/u);
            });
            expect(readFileSync(fixturePath, 'utf8')).toBe('deliberately wrong\n');
        } finally {
            rmSync(fixturePath, { force: true });
        }
    });

    // RUNTIME D3 — every `toMatch` subject resolves against `expected/`; the
    // Refusal names the path it looked at, and only `.request()` reads
    // `requests/`.
    test('toMatch on a missing stream fixture names the path it resolved, and TEST_UPDATE', async () => {
        // Given - a fixture name that was never created
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('help');

        // Then - the failure names the path it resolved and explains how to create the fixture frozen - under TEST_UPDATE the missing fixture must still throw rather than be created
        const message = catchMessage(() => {
            // checker-disable-next-line c8 -- negative spec: the missing fixture IS the behaviour under test
            expect(result.stdout).toMatch(file('./expected/never-created.txt'), { frozen: true });
        });
        expect(message).toContain(
            `does not exist at ${resolve(EXPECTED_DIR, 'never-created.txt')}`,
        );
        expect(message).toMatch(/TEST_UPDATE=1/u);
    });

    // RUNTIME C5 — a slash in a fixture name is a SUBFOLDER of `expected/`,
    // Not a separator the resolver flattens.
    test('a slash in the fixture name creates a subfolder under expected/', async () => {
        // Given - a fixture written via update mode with a slash in its name
        const fixtureName = `sub/help-${Date.now()}.txt`;
        try {
            const a = await cli.fixture(directory('../../fixtures/cli-app/')).exec('help');
            inUpdateMode(() => {
                expect(a.stdout).toMatch(file(`./expected/${fixtureName}`));
            });

            // Then - the file landed at expected/sub/<name> and matches on re-run
            expect(existsSync(resolve(EXPECTED_DIR, fixtureName))).toBeTruthy();
            const b = await cli.fixture(directory('../../fixtures/cli-app/')).exec('help');
            expect(b.stdout).toMatch(file(`./expected/${fixtureName}`));
        } finally {
            rmSync(resolve(EXPECTED_DIR, 'sub'), { force: true, recursive: true });
        }
    });

    test('toMatch requires the extension in the name', async () => {
        // Given - a fixture name without extension
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');

        // Then - the matcher enforces CONVENTIONS C6 frozen - a negative assertion; keep it update-safe alongside the rest of the sweep
        expect(() => {
            // checker-disable-next-line c8 -- negative spec: the golden with no extension exists nowhere, and that IS the behaviour under test
            // oxlint-disable-next-line jterrazz/c6-tomatch-extension -- negative spec: the missing extension IS the behaviour under test
            expect(result.stdout).toMatch(file('./expected/no-extension'), { frozen: true });
        }).toThrow(/extension is part of the path/u);
    });

    test("toContain is vitest's, on the captured text", async () => {
        // Given - a help run
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('help');

        // Then - vitest's own substring check and its own failure, on .text as on any string or array
        expect(result.stdout.text).toContain('Usage: cli <command>');
        expect(() => {
            expect(result.stdout.text).toContain('NOT_THERE');
        }).toThrow(/to contain 'NOT_THERE'/u);
        expect('plain string').toContain('plain');
        expect(['a', 'b']).toContain('b');
    });
});

describe('command — stderr accessor', () => {
    test('text exposes stderr content', async () => {
        // Given - a failing run
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('fail');

        // Then - stderr text is readable
        expect(result.stderr.text).toContain('Fatal: something went wrong');
    });

    test('toMatch round-trips', async () => {
        // Given - a stderr fixture created via update mode
        const fixtureName = `stderr-transient-${Date.now()}.txt`;
        try {
            const a = await cli.fixture(directory('../../fixtures/cli-app/')).exec('fail');
            inUpdateMode(() => {
                expect(a.stderr).toMatch(file(`./expected/${fixtureName}`));
            });

            // Then - a second identical run matches
            const b = await cli.fixture(directory('../../fixtures/cli-app/')).exec('fail');
            expect(b.stderr).toMatch(file(`./expected/${fixtureName}`));
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true });
        }
    });
});

describe('command — json accessor', () => {
    test('value exposes the parsed JSON', async () => {
        // Given - a run printing JSON
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');

        // Then - the parsed value is readable
        expect(result.json).toMatch({
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
            const a = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');
            inUpdateMode(() => {
                expect(a.json).toMatch(file(`./expected/${fixtureName}`));
            });

            // Then - the file is pretty-printed with a trailing newline
            const written = readFileSync(fixturePath, 'utf8');
            expect(written).toMatch(/^\{\n {4}"name": "cli-app"/u);
            expect(written.endsWith('\n')).toBeTruthy();

            // Then - a second identical run matches
            const b = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');
            expect(b.json).toMatch(file(`./expected/${fixtureName}`));
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
            const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');
            expect(result.json).toMatch(file(`./expected/${fixtureName}`));
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
            const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('json');
            inUpdateMode(() => {
                expect(result.json).toMatch(file(`./expected/${fixtureName}`));
            });

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
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('help');

        // Then - reading .value throws with context
        expect(() => result.json.value).toThrow(/stdout is not valid JSON/u);
    });
});

describe('command — filesystem accessor', () => {
    test('cwd points to the temp working directory', async () => {
        // Given - a scaffold run
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');

        // Then - cwd is the isolated temp dir
        expect(result.filesystem.cwd).toMatch(/spec-command-/u);
    });

    test('files() lists the whole tree sorted, filtering defaults', async () => {
        // Given - a scaffold run
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');

        // Then - cli.sh (spread via .fixture(directory('../../fixtures/cli-app/'))) and scaffold output both appear, sorted
        const files = await result.filesystem.files();
        expect(files).toContain('cli.sh');
        expect(files).toContain('out/main.go');
        expect(files).toContain('out/docs/README.md');
        expect([...files].sort()).toStrictEqual(files);
    });

    test('toMatch round-trips the entire working dir', async () => {
        // Given - a tree fixture created via update mode (flat under expected/)
        const fixtureName = `fs-transient-${Date.now()}`;
        try {
            const a = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');
            process.env.TEST_UPDATE = '1';
            try {
                await expect(a.filesystem).toMatch(directory(`./expected/${fixtureName}/`));
            } finally {
                delete process.env.TEST_UPDATE;
            }

            // Then - a second identical run matches
            const b = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');
            await expect(b.filesystem).toMatch(directory(`./expected/${fixtureName}/`));
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true, recursive: true });
        }
    });

    test('toMatch detects a diff', async () => {
        // Given - a fixture from scaffold, compared against scaffold-changed
        const fixtureName = `fs-diff-${Date.now()}`;
        try {
            const a = await cli.fixture(directory('../../fixtures/cli-app/')).exec('scaffold');
            process.env.TEST_UPDATE = '1';
            try {
                await expect(a.filesystem).toMatch(directory(`./expected/${fixtureName}/`));
            } finally {
                delete process.env.TEST_UPDATE;
            }

            // Then - the changed tree fails with a directory diff. Frozen: the fixture written above must not be overwritten with the changed tree under TEST_UPDATE
            const b = await cli
                .fixture(directory('../../fixtures/cli-app/'))
                .exec('scaffold-changed');
            await expect(
                expect(b.filesystem).toMatch(directory(`./expected/${fixtureName}/`), {
                    frozen: true,
                }),
            ).rejects.toThrow(/Directory mismatch/u);
        } finally {
            rmSync(resolve(EXPECTED_DIR, fixtureName), { force: true, recursive: true });
        }
    });
});

describe('command — fixture setup', () => {
    test('copies fixture file into working dir before exec', async () => {
        // Given - fixture file that triggers check failure
        const result = await cli
            .fixture(directory('../../fixtures/cli-app/'))
            .fixture(file('./fixtures/invalid.ts'))
            .exec('check');

        // Then - check detected the invalid file
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('unused-var');
    });

    test('clean project has no invalid files', async () => {
        // Given - the pristine project fixture
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('check');

        // Then - check passes
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('All checks passed');
    });
});

describe('command — file accessor', () => {
    test('exists check', async () => {
        // Given - build creates files
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('build');

        // Then - file exists and absent file doesn't
        expect(result.file('dist/index.js').exists).toBeTruthy();
        expect(result.file('dist/nonexistent.js').exists).toBeFalsy();
    });

    test('content check', async () => {
        // Given - build creates files
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('build');

        // Then - file contains expected content
        expect(result.file('dist/index.js').content).toContain('Hello from CLI app');
    });

    test('chains multiple assertions on one result', async () => {
        // Given - a successful build
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('build');

        // Then - several read accessors on one result
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Build completed');
        expect(result.file('dist/index.js').exists).toBeTruthy();
        expect(result.file('dist/manifest.json').exists).toBeTruthy();
        expect(result.file('dist/index.cjs').exists).toBeFalsy();
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

    test('the json accessor applies transform before JSON.parse', async () => {
        // Given - JSON output wrapped in ANSI codes
        const result = await transformCli.exec('ansi-json');

        // Then - raw stdout still has ANSI wrapping the JSON — would NOT parse
        expect(result.stdout.raw).toContain('\u001B[32m');

        // Then - .json.value works because the transform stripped ANSI before parse
        expect(result.json).toMatch({ status: 'ok', value: 42 });
    });
});

describe('command — fixture tree layering', () => {
    test('layers a shared project and a feature-local file tree into the cwd', async () => {
        // Given - the shared cli-app project spread first, then a feature-local tree (spwn.yaml + spwn/agents/…) laid out exactly as the cwd should look
        const result = await cli
            .fixture(directory('../../fixtures/cli-app/'))
            .fixture(directory('./fixtures/spwn-seed/'))
            .exec('read-seed');

        // Then - the CLI saw both layers as one merged tree: the config file and the nested tree
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            worlds:
                - alpha
                - beta
            agents:
              spwn/agents/neo/journal/session-1.md
        `);
    });

    // RUNTIME B2 — a string is a value: a verb that reads the disk takes file()
    // Or directory(), and a bare string is refused where it is written.
    test('a fixture named by a bare string is refused where it is written', () => {
        // Given - the 16 spelling, a name resolved against a folder the line does not show
        // Then - refused at the call, naming the wrapper to write
        expect(() => cli.fixture('cli-app/' as never)).toThrow(
            /^fixture\("cli-app\/"\): a string is a value — name the disk with file/u,
        );
    });

    test('a directory named by file() is refused with the form to write', async () => {
        // Given - the shared cli-app project named as if it were one file
        // checker-disable-next-line c8 -- negative spec: a directory named by file() IS the behaviour under test
        const run = cli.fixture(file('../../fixtures/cli-app')).exec('help');

        // Then - the path states the kind, so the wrong one is refused rather than guessed
        await expect(run).rejects.toThrow(/names a directory — end its path in \//u);
    });

    test('a later .fixture() overwrites an earlier file (last write wins)', async () => {
        // Given - two feature-local trees that both write spwn.yaml, layered in order
        const result = await cli
            .fixture(directory('./fixtures/layer-base/'))
            .fixture(directory('./fixtures/layer-override/'))
            .exec('help');

        // Then - the later fixture's spwn.yaml overwrote the earlier one
        expect(result.exitCode).toBe(0);
        expect(result.file('spwn.yaml').content).toContain('override-world');
        expect(result.file('spwn.yaml').content).not.toContain('base-world');
    });
});

describe('update mode writes the value in place', () => {
    test('a scratch test holding empty values is filled with what it compared, and the next run reads them back', async () => {
        // Given - a scratch test comparing a stream and a json to empty values, run twice under update mode
        const result = await vitestCli
            .fixture(directory('./fixtures/in-place/'))
            .env({ TEST_UPDATE: '1' })
            .exec(['run', 'run']);

        // Then - both runs passed, and the test now states the whole of each result, indented with its call
        expect(result.exitCode).toBe(0);
        expect(text(result.file('recorded.test.mjs').content)).toMatch(`
            import { expect, test } from 'vitest';

            const { specification, text } = await import(process.env.IN_PLACE_ENTRY);
            const { integration } = await specification.integration({});

            test('records the results in place', async () => {
                const result = await integration.call(() => ({ id: 'order-1', lines: 2 }));
                expect(text('built 3 files in 12ms\\ndone\\n')).toMatch(\`
                    built 3 files in 12ms
                    done
                \`);
                expect(result.value).toMatch({
                    "id": "order-1",
                    "lines": 2
                });
            });
        `);
    });
});
