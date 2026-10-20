import { refusal } from '../../chain/refusals/refusal.js';
import { holdingHost } from './listening.js';

export type Lesson = { fix: string; found: string; why: string };

// outside: Node names a bound port EADDRINUSE, and the frameworks word it as "address already in use" or "port is already in use".
const PORT_IN_USE = /EADDRINUSE|address already in use|port \d+ is already in use/iu;

// invariant: a server that could not bind says so in its output whatever else it printed, and the lesson names the `port` option, the one place a port is chosen.
export function lessonOf(reason: Lesson, output: string, port: number | undefined): Lesson {
    if (!PORT_IN_USE.test(output)) {
        return reason;
    }

    return {
        fix:
            port === undefined
                ? 'have the command listen on the `PORT` it is handed, a free one, or stop the process holding the port it binds'
                : `stop the process holding port ${String(port)}, or drop the \`port\` option so a free one is picked`,
        found: 'the server could not bind its port, which another process already holds',
        why: 'A process is handed a free port unless `port` pins one, and a port another process holds is not free.',
    };
}

// hazard: a port another process holds answers the readiness probe in the server's place (a developer's own `astro dev` on 4321).
export async function refuseHeldPort(
    port: number | undefined,
    specification: string,
    command: string,
): Promise<void> {
    if (port === undefined) {
        return;
    }
    const host = await holdingHost(port);
    if (host === undefined) {
        return;
    }
    throw new Error(
        refusal({
            fix: `stop the process holding port ${String(port)}, or drop the \`port\` option so a free one is picked`,
            found: `specification.${specification}(): port ${String(port)}, which \`port\` pins, is already held: something answers on ${host} before the server is started.\nCommand: ${command}`,
            read: 'docs/reference/services.md#process-the-one-shape-an-external-process-takes',
            why: 'A process pinned to a port is ready once that port answers, and a port another process holds would answer in its place.',
        }),
    );
}
