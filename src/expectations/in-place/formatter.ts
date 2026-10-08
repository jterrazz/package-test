import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const FORMATTER = join('node_modules', '.bin', 'oxfmt');

function formatterOf(file: string): string | undefined {
    for (let directory = dirname(file); ; directory = dirname(directory)) {
        const binary = join(directory, FORMATTER);
        if (existsSync(binary)) {
            return binary;
        }
        if (dirname(directory) === directory) {
            return undefined;
        }
    }
}

// hazard: a rewrite lands in the formatter's style only where the project installs oxfmt; elsewhere it stays as written, and `typescript fix` formats it.
export function formatRewritten(files: readonly string[]): void {
    for (const file of files) {
        const binary = formatterOf(file);
        if (binary !== undefined) {
            const project = dirname(dirname(dirname(binary)));
            // Stryker disable next-line StringLiteral: what the formatter prints is no part of the rewrite
            spawnSync(binary, [file], { cwd: project, stdio: 'ignore' });
        }
    }
}
