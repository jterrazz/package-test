import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';

import { untilDeadline } from '../../chain/pause.js';

export const KILL_GRACE_MS = 2000;

/** outside: Windows has no process groups to signal through a negative pid. */
// Stryker disable next-line ConditionalExpression,StringLiteral: the suite runs on POSIX alone, where every platform signals groups
export const SIGNALS_GROUPS = process.platform !== 'win32';
const GROUP_POLL_MS = 1000;
const GROUP_SETTLE_MS = 50;

/** A process the served one spawned outside its group: its executable, as `ps` names it or as its command line's first word invokes it, is `program` or a path ending in it, and its command line holds every word of `holds`. */
export type Stray = { holds: readonly string[]; program: string };

export type Strays = readonly Stray[];

// invariant: the strays are the script's first argument; a stray may lead a group of its own, which its signal reaches whole.
// outside: Linux's `comm` is the main thread's name, which node renames and the kernel cuts at 15 characters, so the command line's first word names the program there.
const STRAYS_SOURCE = `
const { execFileSync } = require('node:child_process');
const strays = JSON.parse(process.argv[1] ?? '[]');
const listed = (column) => {
    let listing = '';
    try { listing = execFileSync('ps', ['-A', '-o', 'pid=,' + column + '='], { encoding: 'utf8', maxBuffer: 67108864 }); } catch {}
    return new Map(listing.split('\\n').flatMap((line) => {
        const found = /^\\s*(\\d+)\\s(.*)$/u.exec(line);
        return found === null ? [] : [[Number(found[1]), found[2]]];
    }));
};
const names = (path, program) => path === program || path.endsWith('/' + program);
const strayPids = () => {
    const commands = listed('command');
    return [...listed('comm')]
        .filter(([pid, executable]) => {
            const command = commands.get(pid) ?? '';
            return pid !== process.pid && strays.some((stray) =>
                (names(executable, stray.program) || names(command.split(' ')[0], stray.program)) && stray.holds.every((word) => command.includes(word)));
        })
        .map(([pid]) => pid);
};
const signalStrays = (signal) => {
    for (const pid of strays.length === 0 ? [] : strayPids()) {
        try { process.kill(-pid, signal); } catch {}
        try { process.kill(pid, signal); } catch {}
    }
};
`;

/** Its arguments are the strays, then the group. With strays to reap, it outlives the group: a stray outlives the group that spawned it. */
export const WATCHDOG = `${STRAYS_SOURCE}
const group = -Number(process.argv[2]);
const gone = () => { try { process.kill(group, 0); return false; } catch { return true; } };
const end = () => {
    try { process.kill(group, 'SIGTERM'); } catch { if (strays.length === 0) process.exit(0); }
    signalStrays('SIGTERM');
    setTimeout(() => { try { process.kill(group, 'SIGKILL'); } catch {} signalStrays('SIGKILL'); process.exit(0); }, ${KILL_GRACE_MS});
};
process.stdin.on('end', end);
process.stdin.on('error', end);
process.stdin.resume();
setInterval(() => { if (strays.length === 0 && gone()) process.exit(0); }, ${GROUP_POLL_MS});
`;

/** Its argument is the strays: each gets SIGTERM, and SIGKILL when it outlives the grace. */
export const REAPER = `${STRAYS_SOURCE}
signalStrays('SIGTERM');
const deadline = Date.now() + ${KILL_GRACE_MS};
const settle = () => {
    if (strayPids().length === 0) return;
    if (Date.now() >= deadline) { signalStrays('SIGKILL'); return; }
    setTimeout(settle, ${GROUP_SETTLE_MS});
};
settle();
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

export async function groupEnded(group: number, withinMs: number): Promise<boolean> {
    const ended = await untilDeadline(() => !groupRunning(group) || undefined, {
        interval: GROUP_SETTLE_MS,
        timeout: withinMs,
    });
    return ended === true;
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
    // Stryker disable next-line BlockStatement,ConditionalExpression,EqualityOperator: see above
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

// invariant: the group gets SIGTERM, and SIGKILL when it outlives the grace: its leader alive or not, its strays die with it.
export async function endGroup(child: ChildProcess): Promise<void> {
    // Stryker disable next-line BlockStatement,ConditionalExpression,EqualityOperator: a group read from no pid is this very process's, and a mutant of this guard would wait on the run measuring it
    if (child.pid === undefined) {
        return;
    }
    const leaderReaped = reaped(child);
    signalGroup(child, 'SIGTERM');
    if (!(await groupEnded(-child.pid, KILL_GRACE_MS))) {
        signalGroup(child, 'SIGKILL');
    }
    // hazard: macOS skips an exiting process when it signals a group, so the group reads as gone while the leader still holds its port open; its reaping is what proves the port closed.
    await leaderReaped;
}
