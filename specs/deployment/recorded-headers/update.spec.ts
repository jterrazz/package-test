import { file, text } from '@jterrazz/test';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { specimen } from '../deployment.specification.js';
import { deployment } from '../recorded.specification.js';

const EXPECTED_DIR = resolve(import.meta.dirname, '__expected__');

// outside: Git keeps no empty folder, so `__expected__/` goes with its last golden.
function removeGolden(name: string): void {
    rmSync(resolve(EXPECTED_DIR, name), { force: true });
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

describe('update', () => {
    test('update mode writes a fresh golden with the headers the specification records, and the next run reads it back', async () => {
        // Given - a golden that does not exist yet, written under update mode
        const name = `health-${String(process.pid)}.http`;
        try {
            const first = await deployment.get('/health');
            inUpdateMode(() => {
                expect(first.response).toMatch(file(`./__expected__/${name}`));
            });

            // Then - the status, the recorded headers the response carries, and the body; and a second exchange matches it
            const written = readFileSync(resolve(EXPECTED_DIR, name), 'utf8');
            expect(text(written)).toMatch(`
                HTTP/1.1 200 OK
                content-type: application/json
                x-frame-options: DENY

                {
                    "status": "ok"
                }
            `);
            const second = await deployment.get('/health');
            expect(second.response).toMatch(file(`./__expected__/${name}`));
        } finally {
            removeGolden(name);
        }
    });

    test('update mode keeps a golden that states no body bodyless: the probe claims a body by writing it', async () => {
        // Given - a golden naming the status and a header, and no body, rewritten under update mode
        const name = `bodyless-${String(process.pid)}.http`;
        try {
            mkdirSync(EXPECTED_DIR, { recursive: true });
            writeFileSync(resolve(EXPECTED_DIR, name), 'HTTP/1.1 200 OK\nx-frame-options: DENY\n');
            const result = await deployment.get('/health');
            inUpdateMode(() => {
                expect(result.response).toMatch(file(`./__expected__/${name}`));
            });

            // Then - still the status and the header alone
            const written = readFileSync(resolve(EXPECTED_DIR, name), 'utf8');
            expect(text(written)).toMatch(`
                HTTP/1.1 200 OK
                x-frame-options: DENY
            `);
        } finally {
            removeGolden(name);
        }
    });

    test('update mode writes an exchange that never answered as its one line', async () => {
        // Given - a closed port, recorded under update mode
        const name = `refused-${String(process.pid)}.http`;
        try {
            const result = await deployment.get(`${specimen.refused}/health`);
            inUpdateMode(() => {
                expect(result.response).toMatch(file(`./__expected__/${name}`));
            });

            // Then - the golden is the reason
            const written = readFileSync(resolve(EXPECTED_DIR, name), 'utf8');
            expect(text(written)).toMatch(`
                unreachable: refused
            `);
        } finally {
            removeGolden(name);
        }
    });
});
