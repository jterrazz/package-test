import { execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { readdir, readFile, readlink } from 'node:fs/promises';

import { SIGNALS_GROUPS } from './process-group.js';

// outside: `lsof -F pg` prints one `p<pid>` line, then one `g<pgid>` line, per process holding a selected file.
export function ownsFromLsof(output: string, group: number): boolean {
    const groups = output
        .split('\n')
        .filter((line) => line.startsWith('g'))
        .map((line) => line.slice(1));
    return owns(groups, new Set([String(group)]));
}

/** Owned when a listener is the group's and none it can see is outside it. */
export function owns(listeners: readonly string[], owned: ReadonlySet<string>): boolean {
    return listeners.length > 0 && listeners.every((listener) => owned.has(listener));
}

const LISTEN_STATE = '0A';

// outside: a row of `/proc/net/tcp` and `tcp6` reads `sl local_address rem_address st ... uid timeout inode`, the local address `HEXIP:HEXPORT`; the header row's state reads `st`.
export function listeningInodes(table: string, port: number): string[] {
    return table
        .split('\n')
        .map((row) => row.trim().split(/\s+/u))
        .filter(([, local, , state]) => {
            const [, hex] = String(local).split(':');
            return state === LISTEN_STATE && Number.parseInt(String(hex), 16) === port;
        })
        .map((fields) => String(fields[9]));
}

// outside: `/proc/<pid>/stat` reads `pid (comm) state ppid pgrp ...`, and the command name may hold spaces and parentheses itself.
export function processGroupOf(stat: string): number {
    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[2]);
}

// outside: a socket's file descriptor links to `socket:[<inode>]`.
export function socketInode(link: string): string | undefined {
    return /^socket:\[(?<inode>\d+)\]$/u.exec(link)?.groups?.inode;
}

/** The three reads of `/proc` the Linux answer takes, each answering nothing for what it cannot read. */
export type ProcReader = {
    entries: (path: string) => Promise<string[]>;
    link: (path: string) => Promise<string>;
    text: (path: string) => Promise<string>;
};

// Stryker disable StringLiteral,ArrayDeclaration,ArrowFunction: the node filesystem itself, which a module test hands a reader of its own in place of
const NODE_PROC: ProcReader = {
    entries: async (path) => await readdir(path).catch(() => []),
    link: async (path) => await readlink(path).catch(() => ''),
    text: async (path) => await readFile(path, 'utf8').catch(() => ''),
};
// Stryker restore StringLiteral,ArrayDeclaration,ArrowFunction

async function groupInodes(group: number, proc: ProcReader): Promise<Set<string>> {
    // invariant: an entry of /proc that is no process (`net`, `sys`) reads no stat, whose group is no number.
    const pids = await proc.entries('/proc');
    const owned = new Set<string>();
    for (const pid of pids) {
        if (processGroupOf(await proc.text(`/proc/${pid}/stat`)) !== group) {
            continue;
        }
        for (const fd of await proc.entries(`/proc/${pid}/fd`)) {
            const inode = socketInode(await proc.link(`/proc/${pid}/fd/${fd}`));
            if (inode !== undefined) {
                owned.add(inode);
            }
        }
    }
    return owned;
}

/** Linux: the listening sockets of `/proc/net/tcp` and `tcp6` on the port, against the sockets the group's processes hold open. */
export async function ownsOnLinux(
    port: number,
    group: number,
    proc: ProcReader = NODE_PROC,
): Promise<boolean> {
    const tables = await Promise.all(['/proc/net/tcp', '/proc/net/tcp6'].map(proc.text));
    return owns(
        tables.flatMap((table) => listeningInodes(table, port)),
        await groupInodes(group, proc),
    );
}

/** macOS: the groups `lsof` names for the port's listeners; undefined where `program` cannot run. */
export async function ownsOnDarwin(
    port: number,
    group: number,
    program = 'lsof',
): Promise<boolean | undefined> {
    const listed = await new Promise<string | undefined>((resolve) => {
        execFile(
            program,
            ['-nP', '-a', `-iTCP:${String(port)}`, '-sTCP:LISTEN', '-Fpg'],
            (error, stdout) => {
                // outside: lsof exits 1 when no file matches, and a missing lsof fails to spawn.
                resolve(error === null || error.code === 1 ? stdout : undefined);
            },
        );
    });
    return listed === undefined ? undefined : ownsFromLsof(listed, group);
}

/** Whether `port` is listened on by the process group `group` alone, as far as this process can see; undefined where the platform cannot tell. */
export async function groupOwnsPort(
    port: number,
    group: number,
    platform: NodeJS.Platform = process.platform,
): Promise<boolean | undefined> {
    if (platform === 'linux') {
        return await ownsOnLinux(port, group);
    }
    if (platform === 'darwin') {
        return await ownsOnDarwin(port, group);
    }
    return undefined;
}

// invariant: an answer proves the server only once a listener of the port is the command's own process group, and none outside it; a platform that cannot tell takes the answer as the server's.
export async function childOwnsPort(
    port: number,
    child: ChildProcess | null,
): Promise<boolean | undefined> {
    // Stryker disable next-line ConditionalExpression,OptionalChaining: the suite runs on POSIX alone, where the child always leads its group
    const group = SIGNALS_GROUPS ? child?.pid : undefined;
    return group === undefined ? undefined : await groupOwnsPort(port, group);
}
