import { hostname } from 'node:os';

import { OWNER_LABEL, REUSED_LABEL } from './testcontainers.adapter.js';

// invariant: ryuk removes a session's containers only while it runs, and every process shares one session while any holds it: an owner label naming a dead local process marks an orphan.

const SESSION_LABEL = 'org.testcontainers.session-id';

const REAPER_LABEL = 'org.testcontainers.ryuk';

const ENDED = new Set(['dead', 'exited']);

export type ListedContainer = { Id: string; Labels: Record<string, string>; State: string };

export type SweptRuntime = {
    listContainers: (options: {
        all: true;
        filters: { label: string[] };
    }) => Promise<ListedContainer[]>;
    getContainer: (id: string) => {
        remove: (options: { force: true; v: true }) => Promise<unknown>;
    };
};

export type OwnerAlive = (owner: string) => boolean;

/** Dead only when it names this host and no process answers its pid; another host's process is never taken for dead. */
export function ownerAlive(
    owner: string,
    host: string = hostname(),
    probe: (pid: number) => void = (pid) => process.kill(pid, 0),
): boolean {
    const separator = owner.lastIndexOf(':');
    const pid = Number(owner.slice(separator + 1));
    if (
        separator === -1 ||
        owner.slice(0, separator) !== host ||
        !Number.isSafeInteger(pid) ||
        pid <= 0
    ) {
        return true;
    }
    try {
        probe(pid);
        return true;
    } catch (error) {
        return Reflect.get(new Object(error), 'code') !== 'ESRCH';
    }
}

export function orphans(containers: ListedContainer[], alive: OwnerAlive): string[] {
    const reaped = new Set(
        containers
            .filter(
                (container) =>
                    container.State === 'running' && container.Labels[REAPER_LABEL] === 'true',
            )
            .map((reaper) => reaper.Labels[SESSION_LABEL]),
    );
    return containers
        .filter((container) => {
            if (container.Labels[REAPER_LABEL] === 'true') {
                return false;
            }
            const owner = container.Labels[OWNER_LABEL];
            if (owner !== undefined && container.Labels[REUSED_LABEL] !== 'true' && !alive(owner)) {
                return true;
            }
            const session = container.Labels[SESSION_LABEL];
            return (
                session !== undefined &&
                session !== '' &&
                ENDED.has(container.State) &&
                !reaped.has(session)
            );
        })
        .map((container) => container.Id);
}

/** A removal that fails is skipped: a sweep never fails the run. */
export async function sweepOrphans(
    runtime: SweptRuntime,
    alive: OwnerAlive = ownerAlive,
): Promise<string[]> {
    const lists = await Promise.all(
        [SESSION_LABEL, OWNER_LABEL].map(
            async (label) =>
                await runtime.listContainers({ all: true, filters: { label: [label] } }),
        ),
    );
    const listed = [
        ...new Map(lists.flat().map((container) => [container.Id, container])).values(),
    ];
    const found = orphans(listed, alive);
    const removed = await Promise.allSettled(
        found.map(async (id) => {
            await runtime.getContainer(id).remove({ force: true, v: true });
            return id;
        }),
    );
    return removed.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : []));
}
