import { hostname } from 'node:os';

import { OWNER_LABEL, REUSED_LABEL } from './testcontainers.adapter.js';

/**
 * The containers nothing will ever remove but a sweep: the ones a dead
 * testcontainers session left behind, and the ones whose owning process died.
 *
 * Testcontainers labels every container it starts for a run with the session
 * of its reaper (Ryuk), which removes them once the session's last client is
 * gone — but only while the reaper itself runs. An orphan of a session belongs
 * to one, has ended, and no running reaper holds its session.
 *
 * Every process on a machine shares one reaper session while any of them holds
 * it, so a killed run's running containers outlive it as long as another run
 * lasts. The owner label names the process that started a container: one whose
 * owner is dead on this host is an orphan, whatever its state and session.
 */

/** The label naming the reaper session a container belongs to. */
export const SESSION_LABEL = 'org.testcontainers.session-id';

/** The label a reaper carries. */
const REAPER_LABEL = 'org.testcontainers.ryuk';

/** The states a container of a live session never waits in: it ended. */
const ENDED = new Set(['dead', 'exited']);

/** A container as the runtime lists it. */
export type ListedContainer = { Id: string; Labels: Record<string, string>; State: string };

/** The runtime, as far as a sweep reads and removes. */
export type SweptRuntime = {
    listContainers: (options: {
        all: true;
        filters: { label: string[] };
    }) => Promise<ListedContainer[]>;
    getContainer: (id: string) => {
        remove: (options: { force: true; v: true }) => Promise<unknown>;
    };
};

/** Whether the process an owner label names may still run. */
export type OwnerAlive = (owner: string) => boolean;

/**
 * Whether the `<host>:<pid>` an owner label names may still run: dead only
 * when it names this host and no process answers its pid. Another host's
 * process, or a label that names none, is never taken for dead.
 */
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
        const code: unknown =
            typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
        return code !== 'ESRCH';
    }
}

/** The ids of the containers nothing will ever remove but a sweep. */
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

/**
 * Remove every orphan the runtime holds, and answer their ids. A removal that
 * fails is skipped: a sweep never fails the run that asked for it.
 */
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
