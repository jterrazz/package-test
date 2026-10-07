import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        // outside: signal 0 to a process another user owns throws EPERM, and that process is alive.
        // Stryker disable next-line ConditionalExpression,LogicalOperator: process.kill throws only Node's errors, each an Error carrying a code, so the two narrowings decide nothing
        return error instanceof Error && 'code' in error && error.code === 'EPERM';
    }
}

// invariant: the pid a run's folder is named for, `<pid>-…`, or null for a name no run gave.
function runOf(entry: string): null | number {
    const pid = Number(entry.split('-')[0]);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/** Leaves alone every name no run gave: the parent of temp roots is shared with whatever else a user keeps there. */
export function sweepOrphanRoots(parent: string): void {
    for (const entry of readdirSync(parent)) {
        const pid = runOf(entry);
        if (pid !== null && !isAlive(pid)) {
            // invariant: two runs starting at once may sweep the same root, and the second finds it gone.
            // Stryker disable next-line BooleanLiteral: the entry was just listed, so only a concurrent sweep could make `force` matter
            rmSync(join(parent, entry), { force: true, recursive: true });
        }
    }
}

/** Keeps a living run's evidence alone: a finished run's stays until the next run starts, and nothing else is ever kept. */
export function sweepFinishedEvidence(folder: string): void {
    if (!existsSync(folder)) {
        return;
    }
    for (const entry of readdirSync(folder)) {
        const pid = runOf(entry);
        // Stryker disable next-line ConditionalExpression: a name no run gave reads as no pid, which process.kill refuses as it refuses a dead run's — the null test serves the type
        if (pid === null || !isAlive(pid)) {
            // Stryker disable next-line BooleanLiteral: the entry was just listed, so only a concurrent sweep could make `force` matter
            rmSync(join(folder, entry), { force: true, recursive: true });
        }
    }
}
