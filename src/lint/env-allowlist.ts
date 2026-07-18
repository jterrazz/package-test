import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CONVENTIONS E1 — the framework reads only its own generic-prefixed env vars.
 * This module holds the allowlist and the scanner the meta-test uses to prove
 * no other `process.env` coupling slips into non-test `src/`.
 */

/** The only env vars the framework is allowed to read (E1). */
export const ENV_ALLOWLIST = new Set(['TEST_MODE', 'TEST_UPDATE', 'VITEST_POOL_ID']);

const STATIC_READ = /process\.env(?:\.(?<dot>[A-Za-z_]\w*)|\[\s*['"](?<bracket>[^'"]+)['"])/gu;
const DYNAMIC_READ = /process\.env\[\s*(?!['"])/u;

/** Non-test `.ts` files under `dir`, recursively. */
export function sourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules') {
                files.push(...sourceFiles(path));
            }
        } else if (
            entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.test.ts') &&
            !entry.name.endsWith('.fixtures.ts')
        ) {
            files.push(path);
        }
    }
    return files;
}

/** Static env reads (dot or string-bracket access) outside the allowlist. */
export function findEnvOffenders(files: string[]): string[] {
    const offenders: string[] = [];
    for (const file of files) {
        for (const match of readFileSync(file, 'utf8').matchAll(STATIC_READ)) {
            const name = match.groups?.dot ?? match.groups?.bracket ?? '';
            if (!ENV_ALLOWLIST.has(name)) {
                offenders.push(`${file}: process.env.${name}`);
            }
        }
    }
    return offenders;
}

/** Dynamic env reads (computed-key access) lacking an `env-sanction` comment. */
export function findUnsanctionedDynamicReads(files: string[]): string[] {
    const unsanctioned: string[] = [];
    for (const file of files) {
        const lines = readFileSync(file, 'utf8').split('\n');
        for (const [index, line] of lines.entries()) {
            if (!DYNAMIC_READ.test(line)) {
                continue;
            }
            const context = `${lines[index - 1] ?? ''}\n${line}`;
            if (!context.includes('env-sanction')) {
                unsanctioned.push(`${file}:${index + 1}`);
            }
        }
    }
    return unsanctioned;
}
