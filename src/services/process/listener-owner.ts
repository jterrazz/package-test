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

// outside: a row of `/proc/net/tcp` and `tcp6` reads `sl local_address rem_address st ... uid timeout inode`, the local address `HEXIP:HEXPORT`.
export function listeningInodes(table: string, port: number): string[] {
    return table
        .split('\n')
        .slice(1)
        .map((row) => row.trim().split(/\s+/u))
        .filter(
            ([, local = '', , state]) =>
                state === LISTEN_STATE &&
                Number.parseInt(local.split(':').at(-1) ?? '', 16) === port,
        )
        .map((fields) => fields[9] ?? '');
}

// outside: `/proc/<pid>/stat` reads `pid (comm) state ppid pgrp ...`, and the command name may hold spaces and parentheses itself.
export function processGroupOf(stat: string): number {
    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[2]);
}

// outside: a socket's file descriptor links to `socket:[<inode>]`.
export function socketInode(link: string): string | undefined {
    return /^socket:\[(?<inode>\d+)\]$/u.exec(link)?.groups?.inode;
}

async function readable(path: string): Promise<string> {
    return await readFile(path, 'utf8').catch(() => '');
}

async function entries(path: string): Promise<string[]> {
    return await readdir(path).catch(() => []);
}

async function groupInodes(group: number): Promise<Set<string>> {
    const names = await entries('/proc');
    const pids = names.filter((name) => /^\d+$/u.test(name));
    const owned = new Set<string>();
    for (const pid of pids) {
        if (processGroupOf(await readable(`/proc/${pid}/stat`)) !== group) {
            continue;
        }
        for (const fd of await entries(`/proc/${pid}/fd`)) {
            const inode = socketInode(await readlink(`/proc/${pid}/fd/${fd}`).catch(() => ''));
            if (inode !== undefined) {
                owned.add(inode);
            }
        }
    }
    return owned;
}

async function onLinux(port: number, group: number): Promise<boolean> {
    const tables = await Promise.all(['/proc/net/tcp', '/proc/net/tcp6'].map(readable));
    return owns(
        tables.flatMap((table) => listeningInodes(table, port)),
        await groupInodes(group),
    );
}

// outside: lsof exits 1 when no file matches, and a missing lsof fails to spawn.
async function onDarwin(port: number, group: number): Promise<boolean | undefined> {
    const listed = await new Promise<string | undefined>((resolve) => {
        execFile(
            'lsof',
            ['-nP', '-a', `-iTCP:${String(port)}`, '-sTCP:LISTEN', '-Fpg'],
            (error, stdout) => {
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
        return await onLinux(port, group);
    }
    if (platform === 'darwin') {
        return await onDarwin(port, group);
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
