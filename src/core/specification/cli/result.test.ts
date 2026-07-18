import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { structuralEquals, textEquals } from '../../matching/structural.js';
import type { CliOutput } from '../../ports/cli.port.js';
import { CliResult } from './result.js';

const UUID = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';

// Given - a fake command output (mocks are code, CONVENTIONS I4)
const commandOutput: CliOutput = {
    exitCode: 0,
    stderr: '',
    stdout: `{"sessionId":"${UUID}"}`,
};

const workDir = mkdtempSync(resolve(tmpdir(), 'result-scope-'));
afterAll(() => rmSync(workDir, { force: true, recursive: true }));

function makeResult(): CliResult {
    return new CliResult({
        commandOutput,
        config: {},
        testDir: import.meta.dirname,
        workDir,
    });
}

describe('command result — one capture scope per spec execution', () => {
    test('.stdout, .json, and .filesystem share the result scope', () => {
        // Given - one executed result
        const result = makeResult();

        // Then - every accessor hands out the SAME CaptureScope instance
        expect(result.stdout.captures).toBe(result.captures);
        expect(result.stderr.captures).toBe(result.captures);
        expect(result.json.captures).toBe(result.captures);
        expect(result.filesystem.captures).toBe(result.captures);
        expect(result.directory().captures).toBe(result.captures);
    });

    test('a ref captured through one accessor constrains the others', () => {
        // Given - a uuid captured from the stdout text
        const result = makeResult();
        expect(
            textEquals(
                '{"sessionId":"{{uuid#sid}}"}',
                result.stdout.comparableText,
                result.stdout.captures,
            ),
        ).toBe(true);

        // Then - the JSON accessor sees the same capture and enforces equality
        expect(
            structuralEquals(
                { sessionId: `{{uuid#sid}}` },
                result.json.value,
                result.json.captures,
            ),
        ).toBe(true);
        expect(
            structuralEquals(
                { sessionId: '{{uuid#sid}}' },
                { sessionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
                result.json.captures,
            ),
        ).toBe(false);
    });

    test('two results never share a scope', () => {
        // Given - two independent executions
        const first = makeResult();
        const second = makeResult();

        // Then - scopes are per-result (refs reset per chain, CONVENTIONS D4)
        expect(first.captures).not.toBe(second.captures);
    });
});
