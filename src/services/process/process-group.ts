import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';

import { pause } from '../../chain/pause.js';

export const KILL_GRACE_MS = 2000;

/** outside: Windows has no process groups to signal through a negative pid. */
// Stryker disable next-line ConditionalExpression,StringLiteral: the suite runs on POSIX alone, where every platform signals groups
export const SIGNALS_GROUPS = process.platform !== 'win32';
const GROUP_POLL_MS = 1000;
const GROUP_SETTLE_MS = 50;

export const WATCHDOG = `
const group = -Number(process.argv[1]);
const gone = () => { try { process.kill(group, 0); return false; } catch { return true; } };
const end = () => {
    try { process.kill(group, 'SIGTERM'); } catch { process.exit(0); }
    setTimeout(() => { try { process.kill(group, 'SIGKILL'); } catch {} process.exit(0); }, ${KILL_GRACE_MS});
};
process.stdin.on('end', end);
process.stdin.on('error', end);
process.stdin.resume();
setInterval(() => { if (gone()) process.exit(0); }, ${GROUP_POLL_MS});
`;

// Stryker disable BlockStatement: a catch emptied answers undefined, which reads as false all the same
function groupRunning(group: number): boolean {
    try {
        process.kill(group, 0);
        return true;
    } catch {
        return false;
    }
}
// Stryker restore BlockStatement

async function endedBy(group: number, deadline: number): Promise<boolean> {
    if (!groupRunning(group)) {
        return true;
    }
    // Stryker disable next-line EqualityOperator: the deadline is not met to the millisecond
    if (Date.now() >= deadline) {
        return false;
    }
    await pause(GROUP_SETTLE_MS);
    return await endedBy(group, deadline);
}

export async function groupEnded(group: number, withinMs: number): Promise<boolean> {
    return await endedBy(group, Date.now() + withinMs);
}

/** Resolves once the child is reaped, at once for one reaped already. */
export async function reaped(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }
    await once(child, 'exit');
}

/** The child's whole group where groups are signalled, the child alone where they are not or the group is gone; nothing for a child that never started. */
export function signalGroup(
    child: ChildProcess,
    // Stryker disable next-line StringLiteral: an empty signal is read as SIGTERM
    signal: NodeJS.Signals | number = 'SIGTERM',
): boolean {
    // hazard: a child whose spawn failed has no pid, and killing it signals this very process: a mutant of this guard would kill the run measuring it.
    // Stryker disable next-line all: see above
    if (child.pid === undefined) {
        return false;
    }
    // Stryker disable next-line ConditionalExpression: only a platform without groups takes the other branch
    if (SIGNALS_GROUPS) {
        try {
            process.kill(-child.pid, signal);
            return true;
        } catch {
            // outside: the group is already reaped (ESRCH) or not ours to signal.
        }
    }
    return child.kill(signal);
}
