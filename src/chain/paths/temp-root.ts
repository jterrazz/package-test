import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { setupEntry } from './setup-entry.js';

/** Named by uid: a temp directory users share never holds a folder one of them cannot sweep. */
export const TEMP_ROOTS_PARENT = `jterrazz-test-runs-${process.getuid?.() ?? 'user'}`;

const TEMP_VARIABLES = ['TMPDIR', 'TMP', 'TEMP'] as const;

function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error instanceof Error && 'code' in error && error.code === 'EPERM';
    }
}

export function sweepOrphanRoots(parent: string): void {
    for (const entry of readdirSync(parent)) {
        const pid = Number(entry.split('-')[0]);
        if (Number.isInteger(pid) && pid > 0 && !isAlive(pid)) {
            rmSync(join(parent, entry), { force: true, recursive: true });
        }
    }
}

function setVariables(values: Record<string, string | undefined>): void {
    for (const [name, value] of Object.entries(values)) {
        if (value === undefined) {
            // env-sanction: the temp-directory variables, restored to absent
            Reflect.deleteProperty(process.env, name);
        } else {
            // env-sanction: the temp-directory variables, pointed at the root
            process.env[name] = value;
        }
    }
}

export function tempRootSetup(): string {
    return setupEntry(import.meta.dirname, 'temp-root.ts', 'temp-root.js');
}

/** Each project loads this module anew: the run is recognised by the variable itself. */
function joinedRoot(): boolean {
    const current = tmpdir();
    return (
        basename(dirname(current)) === TEMP_ROOTS_PARENT &&
        basename(current).startsWith(`${process.pid}-`)
    );
}

export default function setup(): () => void {
    if (joinedRoot()) {
        return () => {
            // The root is removed by the teardown of the setup that made it.
        };
    }
    const parent = join(tmpdir(), TEMP_ROOTS_PARENT);
    mkdirSync(parent, { recursive: true });
    sweepOrphanRoots(parent);
    const root = mkdtempSync(join(parent, `${process.pid}-`));
    const previous = Object.fromEntries(
        // env-sanction: the temp-directory variables, read to be restored
        TEMP_VARIABLES.map((name) => [name, process.env[name]]),
    );
    setVariables(Object.fromEntries(TEMP_VARIABLES.map((name) => [name, root])));
    return () => {
        setVariables(previous);
        rmSync(root, { force: true, recursive: true });
    };
}
