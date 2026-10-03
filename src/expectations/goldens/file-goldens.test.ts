import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { directory, file } from '../../disk/spec-path.js';
import { DirectoryAccessor } from '../disk/directory.js';
import { ResponseAccessor } from '../http/response.js';
import { JsonAccessor } from '../text/json.js';
import { TextAccessor } from '../text/text.js';
import { registerMatchers } from './matchers.js';

/** Update mode on in a scratch test-dir, both undone when the test ends. */
function updateModeScratch(): string {
    vi.stubEnv('TEST_UPDATE', '1');
    const scratch = mkdtempSync(join(tmpdir(), 'frozen-gate-'));
    onTestFinished(() => {
        rmSync(scratch, { force: true, recursive: true });
    });
    return scratch;
}

await registerMatchers();

describe('file-goldens', () => {
    test('fileGoldens — frozen fixtures are never rewritten under TEST_UPDATE (per-subject write gate, `negative-golden-frozen`) — json: a frozen missing fixture throws instead of being written', () => {
        // Given - a json subject and a fixture name that does not exist on disk
        const scratch = updateModeScratch();
        const accessor = new JsonAccessor('{ "id": 1 }', 'stdout', scratch);
        const fixturePath = resolve(scratch, '_expected', 'frozen.json');

        // Then - update mode is bypassed: it throws the does-not-exist error, no write
        expect(() => {
            // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(accessor).toMatch(file('./_expected/frozen.json'), { frozen: true });
        }).toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
        expect(existsSync(fixturePath)).toBe(false);
    });

    test('fileGoldens — frozen fixtures are never rewritten under TEST_UPDATE (per-subject write gate, `negative-golden-frozen`) — json: a frozen wrong fixture keeps its content and throws its diff', () => {
        // Given - a deliberately-wrong committed json fixture
        const scratch = updateModeScratch();
        const fixturePath = resolve(scratch, '_expected', 'wrong.json');
        mkdirSync(resolve(scratch, '_expected'), { recursive: true });
        writeFileSync(fixturePath, '{\n    "id": 999\n}\n');
        const accessor = new JsonAccessor('{ "id": 1 }', 'stdout', scratch);

        // Then - frozen mismatch still throws and never overwrites
        expect(() => {
            // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(accessor).toMatch(file('./_expected/wrong.json'), { frozen: true });
        }).toThrow('wrong.json');
        expect(readFileSync(fixturePath, 'utf8')).toBe('{\n    "id": 999\n}\n');
    });

    test('fileGoldens — frozen fixtures are never rewritten under TEST_UPDATE (per-subject write gate, `negative-golden-frozen`) — json: without frozen, update mode writes the fixture (control)', () => {
        // Given - the same missing fixture, but NOT frozen
        const scratch = updateModeScratch();
        const accessor = new JsonAccessor('{ "id": 1 }', 'stdout', scratch);
        const fixturePath = resolve(scratch, '_expected', 'written.json');

        // Then - update mode writes it and passes
        // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(accessor).toMatch(file('./_expected/written.json'));
        expect(existsSync(fixturePath)).toBe(true);
    });

    test('fileGoldens — frozen fixtures are never rewritten under TEST_UPDATE (per-subject write gate, `negative-golden-frozen`) — response: a frozen missing fixture throws instead of being written', () => {
        // Given - a response subject and a missing fixture
        const scratch = updateModeScratch();
        const accessor = new ResponseAccessor(
            { body: { ok: true }, headers: { 'content-type': 'application/json' }, status: 200 },
            scratch,
        );
        const fixturePath = resolve(scratch, '_expected', 'frozen.http');

        // Then - frozen bypasses the write, throwing the does-not-exist error
        expect(() => {
            // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(accessor).toMatch(file('./_expected/frozen.http'), { frozen: true });
        }).toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
        expect(existsSync(fixturePath)).toBe(false);
    });

    test('fileGoldens — frozen fixtures are never rewritten under TEST_UPDATE (per-subject write gate, `negative-golden-frozen`) — response: without frozen, update mode writes the fixture (control)', () => {
        // Given - the same missing fixture, not frozen
        const scratch = updateModeScratch();
        const accessor = new ResponseAccessor(
            { body: { ok: true }, headers: { 'content-type': 'application/json' }, status: 200 },
            scratch,
        );
        const fixturePath = resolve(scratch, '_expected', 'written.http');

        // Then - update mode writes and passes
        // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(accessor).toMatch(file('./_expected/written.http'));
        expect(existsSync(fixturePath)).toBe(true);
    });

    test('fileGoldens — frozen fixtures are never rewritten under TEST_UPDATE (per-subject write gate, `negative-golden-frozen`) — tree: a frozen missing fixture throws instead of being written', async () => {
        // Given - an actual output tree and a directory fixture that does not exist
        const scratch = updateModeScratch();
        const actualRoot = resolve(scratch, 'actual');
        mkdirSync(actualRoot, { recursive: true });
        writeFileSync(resolve(actualRoot, 'file.txt'), 'hello\n');
        const accessor = new DirectoryAccessor(actualRoot, scratch);
        const fixtureDir = resolve(scratch, '_expected', 'frozen-tree');

        // Then - frozen bypasses the write (async matcher rejects), nothing created
        await expect(
            // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(accessor).toMatch(directory('./_expected/frozen-tree/'), { frozen: true }),
        ).rejects.toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
        expect(existsSync(fixtureDir)).toBe(false);
    });

    test('fileGoldens — frozen fixtures are never rewritten under TEST_UPDATE (per-subject write gate, `negative-golden-frozen`) — tree: without frozen, update mode writes the fixture tree (control)', async () => {
        // Given - the same actual tree and a missing fixture, not frozen
        const scratch = updateModeScratch();
        const actualRoot = resolve(scratch, 'actual');
        mkdirSync(actualRoot, { recursive: true });
        writeFileSync(resolve(actualRoot, 'file.txt'), 'hello\n');
        const accessor = new DirectoryAccessor(actualRoot, scratch);
        const fixtureFile = resolve(scratch, '_expected', 'written-tree', 'file.txt');

        // Then - update mode copies the tree and passes
        // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        await expect(accessor).toMatch(directory('./_expected/written-tree/'));
        expect(existsSync(fixtureFile)).toBe(true);
    });

    test('fileGoldens — the hint a missing golden gives names a run that does something — an ordinary missing golden sends the author to update mode', () => {
        // Given - a subject whose fixture was never written
        const testDir = mkdtempSync(join(tmpdir(), 'hint-'));
        const subject = new TextAccessor('out', 'stdout', testDir);

        // Then - update mode is where it comes from
        expect(() => {
            // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(subject).toMatch(file('./_expected/nowhere.txt'));
        }).toThrow('Run with TEST_UPDATE=1');
    });

    test('fileGoldens — the hint a missing golden gives names a run that does something — a FROZEN missing golden does not, because update mode skips it', () => {
        // Given - the same subject, asked for a frozen fixture that is absent
        const testDir = mkdtempSync(join(tmpdir(), 'hint-'));
        const subject = new TextAccessor('out', 'stdout', testDir);

        // Then - the hint names the two things that do work, and not the one that silently writes nothing: `{ frozen }` IS the no-write switch
        expect(() => {
            // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(subject).toMatch(file('./_expected/nowhere.txt'), { frozen: true });
        }).toThrow('Write the file by hand');
    });
});
