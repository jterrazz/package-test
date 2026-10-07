import { directory, file, text } from '@jterrazz/test';
import { existsSync, readdirSync, rmdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { cli } from '../cli.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, '__expected__');

// outside: Git keeps no empty folder, so `__expected__/` goes with its last golden.
function removeGolden(path: string): void {
    rmSync(path, { force: true, recursive: true });
    if (existsSync(EXPECTED_DIR) && readdirSync(EXPECTED_DIR).length === 0) {
        rmdirSync(EXPECTED_DIR);
    }
}

function inUpdateMode(block: () => void): void {
    vi.stubEnv('TEST_UPDATE', '1');
    try {
        block();
    } finally {
        vi.unstubAllEnvs();
    }
}

function catchMessage(assertion: () => unknown): string {
    try {
        assertion();
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    throw new Error('expected the assertion to throw, but it passed');
}

/* invariant: the accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */

describe('comparison', () => {
    test('text exposes the comparable string', async () => {
        // Given - a help run
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('help');

        // Then - the text is readable
        expect(result.stdout.text).toContain('Usage: cli <command>');
    });

    test('coerces to primitive string via String()', async () => {
        // Given - a help run
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('help');

        // Then - toString/valueOf keep string coercion working
        expect(String(result.stdout)).toContain('Usage:');
        expect(result.stdout.text).toContain('Usage:');
    });

    test('the stdout mismatch diff is goldened in full (failure-message quality is the product)', async () => {
        // Given - a run whose output differs from a committed, deliberately-wrong fixture
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('help');

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

    // RUNTIME golden-read-from-its-path — every `toMatch` subject resolves against `__expected__/`; the refusal names the path it looked at, and only `.request()` reads `__requests__/`.
    test('toMatch on a missing stream fixture names the path it resolved, and TEST_UPDATE', async () => {
        // Given - a fixture name that was never created
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('help');

        // Then - the failure names the path it resolved and explains how to create the fixture frozen - under TEST_UPDATE the missing fixture must still throw rather than be created
        const message = catchMessage(() => {
            // checker-disable-next-line named-path-exists -- negative spec: the missing fixture IS the behaviour under test
            expect(result.stdout).toMatch(file('./__expected__/never-created.txt'), {
                frozen: true,
            });
        });
        expect(message).toContain(
            `does not exist at ${resolve(EXPECTED_DIR, 'never-created.txt')}`,
        );
        expect(message).toMatch(/TEST_UPDATE=1/u);
    });

    // RUNTIME golden-path-creates-folders — a slash in a fixture name is a SUBFOLDER of `__expected__/`, not a separator the resolver flattens.
    test('a slash in the fixture name creates a subfolder under __expected__/', async () => {
        // Given - a fixture written via update mode with a slash in its name
        const fixtureName = `sub/help-${Date.now()}.txt`;
        try {
            const a = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('help');
            inUpdateMode(() => {
                expect(a.stdout).toMatch(file(`./__expected__/${fixtureName}`));
            });

            // Then - the file landed at __expected__/sub/<name> and matches on re-run
            expect(existsSync(resolve(EXPECTED_DIR, fixtureName))).toBe(true);
            const b = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('help');
            expect(b.stdout).toMatch(file(`./__expected__/${fixtureName}`));
        } finally {
            removeGolden(resolve(EXPECTED_DIR, 'sub'));
        }
    });

    test("toContain is vitest's, on the captured text", async () => {
        // Given - a help run
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('help');

        // Then - vitest's own substring check and its own failure, on .text as on any string or array
        expect(result.stdout.text).toContain('Usage: cli <command>');
        expect(() => {
            expect(result.stdout.text).toContain('NOT_THERE');
        }).toThrow(/to contain 'NOT_THERE'/u);
        expect('plain string').toContain('plain');
        expect(['a', 'b']).toContain('b');
    });

    test('throws a clear error when stdout is not JSON', async () => {
        // Given - non-JSON output
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('help');

        // Then - reading .value throws with context
        expect(() => result.json.value).toThrow(/stdout is not valid JSON/u);
    });

    // RUNTIME disk-named-by-relative-path-at-runtime — a string is a value: a verb that reads the disk takes file() or directory(), and a bare string is refused where it is written.
    test('a fixture named by a bare string is refused where it is written', () => {
        // Given - a bare name, resolved against a folder the line does not show
        // Then - refused at the call, naming the wrapper to write
        // @ts-expect-error -- a bare string is no disk value, which the compiler refuses too
        expect(() => cli.fixture('cli-app/')).toThrow(
            /^found: fixture\("cli-app\/"\), a value where the disk is read\n.*\nfix: name the disk: fixture\(file/u,
        );
    });

    test('a directory named by file() is refused with the form to write', async () => {
        // Given - the shared cli-app project named as if it were one file
        // checker-disable-next-line named-path-exists -- negative spec: a directory named by file() IS the behaviour under test
        const run = cli.fixture(file('../__fixtures__/specimen-cli')).exec('help');

        // Then - the path states the kind, so the wrong one is refused rather than guessed
        await expect(run).rejects.toThrow(/names a directory\n.*\nfix: end its path in \//u);
    });

    test('a later .fixture() overwrites an earlier file (last write wins)', async () => {
        // Given - two feature-local trees that both write spwn.yaml, layered in order
        const result = await cli
            .fixture(directory('./__fixtures__/layer-base/'))
            .fixture(directory('./__fixtures__/layer-override/'))
            .exec('help');

        // Then - the later fixture's spwn.yaml overwrote the earlier one
        expect(result.exitCode).toBe(0);
        expect(result.file('spwn.yaml').content).toContain('override-world');
        expect(result.file('spwn.yaml').content).not.toContain('base-world');
    });
});
