/**
 * The containers a dead testcontainers session left behind.
 *
 * Testcontainers labels every container it starts for a run with the session
 * of its reaper (Ryuk), which removes them once the session's last client is
 * gone — but only while the reaper itself runs. An orphan belongs to a
 * session, has ended, and no running reaper holds its session: nothing will
 * ever remove it but a sweep.
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

/** The ids of the ended containers whose session no running reaper holds. */
export function orphans(containers: ListedContainer[]): string[] {
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
            const session = container.Labels[SESSION_LABEL];
            return (
                session !== undefined &&
                session !== '' &&
                container.Labels[REAPER_LABEL] !== 'true' &&
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
export async function sweepOrphans(runtime: SweptRuntime): Promise<string[]> {
    const listed = await runtime.listContainers({ all: true, filters: { label: [SESSION_LABEL] } });
    const found = orphans(listed);
    const removed = await Promise.allSettled(
        found.map(async (id) => {
            await runtime.getContainer(id).remove({ force: true, v: true });
            return id;
        }),
    );
    return removed.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : []));
}
