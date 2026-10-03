import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, inject, onTestFinished } from 'vitest';

import { ResponseAccessor } from '../http/response.js';
import { deferRewritesTo } from '../in-place/in-place.js';
import { WHOLE_MATCHER } from './text-assertions.js';

export const UUID = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';

export const WORKDIR = '/tmp/spec-run-abcdef';

export function plainCount(dir: string): ResponseAccessor {
    return new ResponseAccessor(
        { body: '42', headers: { 'content-type': 'text/plain' }, status: 200 },
        dir,
    );
}

export function goldenDir(content: string): { dir: string; read: () => string } {
    const dir = mkdtempSync(join(tmpdir(), 'untyped-golden-'));
    onTestFinished(() => {
        rmSync(dir, { force: true, recursive: true });
    });
    mkdirSync(join(dir, '_expected'));
    const path = join(dir, '_expected', 'count.http');
    writeFileSync(path, content);
    return { dir, read: () => readFileSync(path, 'utf8') };
}

export type Whole = (expected: unknown, options: unknown, stack: string) => unknown;

type Registered = (expected: unknown, call: { options: unknown; stack: string }) => unknown;

export function wholeOf(subject: unknown, negated = false): Whole {
    // oxlint-disable-next-line vitest/valid-expect -- the assertion's matcher is the registered comparison, called below by the name no member access spells
    const assertion = expect(subject);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the matcher is registered under a name no member access spells; reaching it by that name is how a test hands it a stack of its own
    const target = (negated ? assertion.not : assertion) as unknown as Record<string, Registered>;
    return (expected, options, stack) => target[WHOLE_MATCHER]?.(expected, { options, stack });
}

export function scratchTest(call: string): { file: string; read: () => string; stack: string } {
    const scratch = mkdtempSync(join(tmpdir(), 'whole-in-place-'));
    const testFile = join(scratch, 'scratch.test.ts');
    writeFileSync(testFile, `test('records', async () => {\n    ${call}\n});\n`);
    // invariant: a scratch test is read back by the test that wrote it: written at once.
    deferRewritesTo(null);
    onTestFinished(() => {
        rmSync(scratch, { force: true, recursive: true });
        deferRewritesTo(() => inject('inPlaceRewrites'));
    });
    return {
        file: testFile,
        read: () => readFileSync(testFile, 'utf8'),
        stack: `Error: toMatch call site\n    at ${testFile}:2:5`,
    };
}
