import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isTestFileName } from './role.js';

export const ENV_ALLOWLIST = new Set(['TEST_UPDATE', 'VITEST_POOL_ID']);

const STATIC_READ = /process\.env(?:\.(?<dot>[A-Za-z_]\w*)|\[\s*['"](?<bracket>[^'"]+)['"])/gu;
const DYNAMIC_READ = /process\.env\[\s*(?!['"])/u;

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
            !isTestFileName(entry.name) &&
            !entry.name.endsWith('.fixtures.ts')
        ) {
            files.push(path);
        }
    }
    return files;
}

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
